export const STATUS_OPTIONS = ['pending', 'confirmed', 'rejected', 'production', 'shipping', 'arrived', 'delivered'];

export const STATUS_STYLES = {
    pending: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning)]/20 hover:bg-[var(--color-warning-bg)]/80',
    confirmed: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)] border-[var(--color-info)]/20 hover:bg-[var(--color-info-bg)]/80',
    rejected: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger)]/20 hover:bg-[var(--color-danger-bg)]/80',
    production: 'bg-[var(--color-purple-bg)] text-[var(--color-purple-text)] border-[var(--color-purple)]/20 hover:bg-[var(--color-purple-bg)]/80',
    shipping: 'bg-[var(--color-cyan-bg)] text-[var(--color-cyan-text)] border-[var(--color-cyan)]/20 hover:bg-[var(--color-cyan-bg)]/80',
    arrived: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border-[var(--color-success)]/20 hover:bg-[var(--color-success-bg)]/80',
    delivered: 'bg-[var(--color-gray-100)] text-[var(--color-gray-600)] border-[var(--color-gray-200)] hover:bg-[var(--color-gray-200)]'
};

export const STATUS_DOTS = {
    pending: 'bg-[var(--color-warning)]',
    confirmed: 'bg-[var(--color-info)]',
    rejected: 'bg-[var(--color-danger)]',
    production: 'bg-[var(--color-purple)]',
    shipping: 'bg-[var(--color-cyan)]',
    arrived: 'bg-[var(--color-success)]',
    delivered: 'bg-[var(--color-gray-500)]'
};

export const getStatusVariant = (status) => {
    const map = {
        pending: 'warning',
        confirmed: 'info',
        rejected: 'error',
        production: 'purple',
        shipping: 'cyan',
        arrived: 'success',
        delivered: 'default'
    };
    return map[status] || 'default';
};
