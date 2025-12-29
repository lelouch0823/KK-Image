export const STATUS_OPTIONS = ['pending', 'confirmed', 'rejected', 'production', 'shipping', 'arrived', 'delivered'];

export const STATUS_STYLES = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
    confirmed: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    rejected: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    production: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    shipping: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100',
    arrived: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    delivered: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
};

export const STATUS_DOTS = {
    pending: 'bg-yellow-500',
    confirmed: 'bg-blue-500',
    rejected: 'bg-red-500',
    production: 'bg-purple-500',
    shipping: 'bg-cyan-500',
    arrived: 'bg-green-500',
    delivered: 'bg-gray-500'
};
