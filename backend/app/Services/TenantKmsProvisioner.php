<?php

namespace App\Services;

use App\Models\Business;
use Aws\Kms\KmsClient;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

/**
 * Creates one customer-managed KMS key per tenant (Business), with a policy
 * that locks the Laravel app's IAM user to encrypt/decrypt only when the
 * caller supplies the matching business_id in the encryption context.
 *
 * Idempotent: re-running for an already-provisioned tenant is a no-op.
 * The alias `{prefix}/{business_id}` is the durable identity used by
 * TenantDocumentStorage; we look it up before doing anything.
 */
class TenantKmsProvisioner
{
    public function __construct(
        private readonly ?string $accountId,
        private readonly string $region,
        private readonly string $appIamUser,
        private readonly ?string $aliasPrefix,
    ) {
    }

    /**
     * @return array{key_id:string,alias:string,created:bool}
     */
    public function provision(Business $business): array
    {
        $this->assertConfigured();

        $alias = $this->aliasFor($business);
        $kms = $this->client();

        if ($existingKeyId = $this->findExistingKey($kms, $alias)) {
            Log::info('TenantKmsProvisioner: alias already exists, skipping', [
                'business_id' => $business->id,
                'alias' => $alias,
                'key_id' => $existingKeyId,
            ]);
            return ['key_id' => $existingKeyId, 'alias' => $alias, 'created' => false];
        }

        $created = $kms->createKey([
            'Description' => "Firmly tenant {$business->id} document encryption",
            'KeyUsage' => 'ENCRYPT_DECRYPT',
            'KeySpec' => 'SYMMETRIC_DEFAULT',
            'Origin' => 'AWS_KMS',
            'MultiRegion' => false,
            'Policy' => json_encode($this->buildKeyPolicy($business), JSON_UNESCAPED_SLASHES),
            'Tags' => [
                ['TagKey' => 'app', 'TagValue' => 'firmly'],
                ['TagKey' => 'env', 'TagValue' => 'prod'],
                ['TagKey' => 'tenant_id', 'TagValue' => (string) $business->id],
            ],
        ]);

        $keyId = $created['KeyMetadata']['KeyId'] ?? null;
        if (!$keyId) {
            throw new RuntimeException('KMS createKey returned no KeyId');
        }

        try {
            $kms->createAlias([
                'AliasName' => $alias,
                'TargetKeyId' => $keyId,
            ]);
            $kms->enableKeyRotation([
                'KeyId' => $keyId,
            ]);
        } catch (Throwable $e) {
            // The key got created but we failed to attach the alias or enable
            // rotation. Schedule the orphan for deletion so it doesn't sit
            // around indefinitely, then rethrow so the job retries cleanly.
            $this->scheduleOrphanForDeletion($kms, $keyId, $e);
            throw $e;
        }

        Log::info('TenantKmsProvisioner: provisioned tenant key', [
            'business_id' => $business->id,
            'alias' => $alias,
            'key_id' => $keyId,
        ]);

        return ['key_id' => $keyId, 'alias' => $alias, 'created' => true];
    }

    public function aliasFor(Business $business): string
    {
        return rtrim((string) $this->aliasPrefix, '/') . '/' . $business->id;
    }

    private function findExistingKey(KmsClient $kms, string $alias): ?string
    {
        try {
            $res = $kms->describeKey(['KeyId' => $alias]);
            return $res['KeyMetadata']['KeyId'] ?? null;
        } catch (Throwable $e) {
            if (method_exists($e, 'getAwsErrorCode') && $e->getAwsErrorCode() === 'NotFoundException') {
                return null;
            }
            throw $e;
        }
    }

    private function buildKeyPolicy(Business $business): array
    {
        $accountId = $this->accountId;
        $appPrincipal = "arn:aws:iam::{$accountId}:user/{$this->appIamUser}";

        return [
            'Version' => '2012-10-17',
            'Id' => "firmly-tenant-{$business->id}-key-policy",
            'Statement' => [
                [
                    'Sid' => 'RootAdmin',
                    'Effect' => 'Allow',
                    'Principal' => ['AWS' => "arn:aws:iam::{$accountId}:root"],
                    'Action' => 'kms:*',
                    'Resource' => '*',
                ],
                [
                    'Sid' => 'AppUseTenantContextOnly',
                    'Effect' => 'Allow',
                    'Principal' => ['AWS' => $appPrincipal],
                    'Action' => [
                        'kms:Encrypt',
                        'kms:Decrypt',
                        'kms:GenerateDataKey',
                    ],
                    'Resource' => '*',
                    'Condition' => [
                        'StringEquals' => [
                            'kms:EncryptionContext:business_id' => (string) $business->id,
                        ],
                    ],
                ],
                [
                    'Sid' => 'AppDescribeKey',
                    'Effect' => 'Allow',
                    'Principal' => ['AWS' => $appPrincipal],
                    'Action' => 'kms:DescribeKey',
                    'Resource' => '*',
                ],
            ],
        ];
    }

    private function scheduleOrphanForDeletion(KmsClient $kms, string $keyId, Throwable $cause): void
    {
        try {
            $kms->scheduleKeyDeletion([
                'KeyId' => $keyId,
                'PendingWindowInDays' => 7,
            ]);
            Log::warning('TenantKmsProvisioner: alias/rotation step failed, scheduled orphan key for deletion', [
                'key_id' => $keyId,
                'cause' => $cause->getMessage(),
            ]);
        } catch (Throwable $cleanup) {
            Log::error('TenantKmsProvisioner: orphan key cleanup failed', [
                'key_id' => $keyId,
                'cause' => $cause->getMessage(),
                'cleanup_error' => $cleanup->getMessage(),
            ]);
        }
    }

    private function client(): KmsClient
    {
        return new KmsClient([
            'region' => $this->region,
            'version' => 'latest',
            'credentials' => [
                'key' => (string) config('filesystems.disks.s3.key', env('AWS_ACCESS_KEY_ID')),
                'secret' => (string) config('filesystems.disks.s3.secret', env('AWS_SECRET_ACCESS_KEY')),
            ],
        ]);
    }

    private function assertConfigured(): void
    {
        if (empty($this->accountId)) {
            throw new RuntimeException('TenantKmsProvisioner: AWS_ACCOUNT_ID is not configured');
        }
        if (empty($this->aliasPrefix)) {
            throw new RuntimeException('TenantKmsProvisioner: FIRMLY_DOCUMENT_KMS_ALIAS_PREFIX is not configured');
        }
        if (empty($this->appIamUser)) {
            throw new RuntimeException('TenantKmsProvisioner: KMS app IAM user is not configured');
        }
    }
}
