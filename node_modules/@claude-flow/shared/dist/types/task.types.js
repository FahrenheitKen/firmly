/**
 * V3 Task Types
 * Modernized type system with strict TypeScript
 */
/**
 * Priority value conversion
 */
export function priorityToNumber(priority) {
    if (typeof priority === 'number') {
        return Math.max(0, Math.min(100, priority));
    }
    switch (priority) {
        case 'critical': return 100;
        case 'high': return 75;
        case 'medium': return 50;
        case 'low': return 25;
        default: return 50;
    }
}
/**
 * Priority number to label
 */
export function numberToPriority(value) {
    if (value >= 90)
        return 'critical';
    if (value >= 70)
        return 'high';
    if (value >= 40)
        return 'medium';
    return 'low';
}
//# sourceMappingURL=task.types.js.map