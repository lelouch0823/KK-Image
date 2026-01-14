import { STATUS_CONFIG, OrderStatus } from '../../utils/constants';

/**
 * 状态标签组件
 */
Component({
    options: {
        styleIsolation: 'shared',
    },

    properties: {
        status: {
            type: String,
            value: 'pending',
            observer: 'updateConfig',
        },
    },

    data: {
        config: STATUS_CONFIG['pending'],
    },

    methods: {
        updateConfig(newStatus: OrderStatus) {
            if (STATUS_CONFIG[newStatus]) {
                this.setData({ config: STATUS_CONFIG[newStatus] });
            }
        },
    },
});
