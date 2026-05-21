<?php

namespace App\Services;

/**
 * Wraps `soffice --headless --convert-to pdf`. Each call uses an isolated
 * user-profile dir so concurrent conversions don't fight over the LibreOffice
 * profile lock, and pinned HOME/XDG_CACHE_HOME so the php-fpm user (who has
 * no writable home) can run it.
 */
class WordToPdfConverter
{
    /**
     * Convert a Word document at $sourcePath into a PDF. Returns the path of
     * the produced PDF, or null on failure. Caller is responsible for cleaning
     * up the returned path (and its parent `firmly-docx-*` directory).
     */
    public function convert(string $sourcePath): ?string
    {
        $soffice = trim((string) @shell_exec('command -v soffice'));
        if ($soffice === '' || !is_file($sourcePath)) {
            return null;
        }

        $outDir = sys_get_temp_dir() . '/firmly-docx-' . bin2hex(random_bytes(6));
        if (!mkdir($outDir, 0700, true) && !is_dir($outDir)) {
            return null;
        }

        $profileDir = $outDir . '/profile';
        $homeDir    = $outDir . '/home';
        @mkdir($homeDir, 0700, true);

        $cmd = sprintf(
            'HOME=%s XDG_CACHE_HOME=%s %s -env:UserInstallation=file://%s --headless --convert-to pdf --outdir %s %s 2>&1',
            escapeshellarg($homeDir),
            escapeshellarg($homeDir . '/.cache'),
            escapeshellcmd($soffice),
            escapeshellarg($profileDir),
            escapeshellarg($outDir),
            escapeshellarg($sourcePath),
        );

        @exec($cmd, $output, $exitCode);

        $basename = pathinfo($sourcePath, PATHINFO_FILENAME);
        $pdfPath  = $outDir . '/' . $basename . '.pdf';

        $this->rrmdir($profileDir);
        $this->rrmdir($homeDir);

        if ($exitCode !== 0 || !is_file($pdfPath)) {
            $this->rrmdir($outDir);
            return null;
        }

        return $pdfPath;
    }

    /**
     * Recursively remove a directory. Used by callers to clean the
     * `firmly-docx-*` dir after they've finished with the returned PDF.
     */
    public function cleanup(string $pdfPath): void
    {
        @unlink($pdfPath);
        $parent = dirname($pdfPath);
        if (is_dir($parent) && str_contains($parent, 'firmly-docx-')) {
            $this->rrmdir($parent);
        }
    }

    private function rrmdir(string $dir): void
    {
        if (!is_dir($dir)) return;
        $items = @scandir($dir) ?: [];
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') continue;
            $path = $dir . '/' . $item;
            is_dir($path) ? $this->rrmdir($path) : @unlink($path);
        }
        @rmdir($dir);
    }
}
