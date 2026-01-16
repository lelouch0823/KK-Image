/**
 * 订单表单页
 */

// ... (Imports remain same)
import { post, uploadFile, getAccessToken, getFileUrl } from '../../utils/api';
import { API } from '../../utils/constants';

interface FormData {
    name: string;
    brand: string;
    series: string;
    size: string;
    color: string;
    material: string;
    remark: string;
    deadline: string;
}

// TDesign Upload File format
interface UploadFile {
    url: string;
    name?: string;
    type?: 'image' | 'video';
    percent?: number;
    status?: 'loading' | 'reload' | 'failed' | 'done';
}

Page({
    data: {
        form: {
            name: '',
            brand: '',
            series: '',
            size: '',
            color: '',
            material: '',
            remark: '',
            deadline: '',
        } as FormData,
        fileList: [] as UploadFile[], // TDesign uses fileList
        submitting: false,

        // Date Picker
        dateVisible: false,
        minDate: new Date().getTime(),
        maxDate: new Date(new Date().setMonth(new Date().getMonth() + 3)).getTime(),
    },

    onLoad(options: { prefill?: string }) {
        // Prefill logic
        if (options.prefill) {
            try {
                const prefill = JSON.parse(decodeURIComponent(options.prefill));
                this.setData({ form: { ...this.data.form, ...prefill } });
            } catch (e) {
                console.error('Parse prefill failed:', e);
            }
        }
    },

    // Input Handler
    onInput(e: WechatMiniprogram.CustomEvent) {
        const { field } = e.currentTarget.dataset;
        const { value } = e.detail; // TDesign sends value in detail
        this.setData({
            [`form.${field}`]: value,
        });
    },

    // Date Picker Handlers
    showDatePicker() {
        this.setData({ dateVisible: true });
    },
    hideDatePicker() {
        this.setData({ dateVisible: false });
    },
    onConfirmDate(e: WechatMiniprogram.CustomEvent) {
        const { value } = e.detail;
        this.setData({
            'form.deadline': value,
            dateVisible: false,
        });
    },

    // Upload Handlers
    handleAdd(e: WechatMiniprogram.CustomEvent) {
        const { files } = e.detail;
        const newFiles = files.map((file: any) => ({
            ...file,
            status: 'loading', // Initial status
        }));

        this.setData({
            fileList: [...this.data.fileList, ...newFiles],
        });

        // Trigger upload immediately for new files
        this.processUpload(newFiles);
    },

    handleRemove(e: WechatMiniprogram.CustomEvent) {
        const { index } = e.detail;
        const { fileList } = this.data;
        fileList.splice(index, 1);
        this.setData({ fileList });
    },

    onUnload() {
        // 页面卸载时关闭提醒
        if (wx.disableAlertBeforeUnload) {
            wx.disableAlertBeforeUnload();
        }
    },

    async processUpload(files: any[]) {
        const accessToken = getAccessToken();
        if (!accessToken) return;

        // 开启退出提醒 (SOTA UX)
        if (wx.enableAlertBeforeUnload) {
            wx.enableAlertBeforeUnload({
                message: '图片正在上传中，退出可能导致上传中断，确定退出吗？'
            });
        }

        const uploadTasks = files.map(async (file) => {
            const currentFiles = this.data.fileList;
            const index = currentFiles.findIndex(f => f.url === file.url);
            if (index === -1) return;

            // 注册到全局管理器 (WANT 模式)
            const taskId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            import('../../utils/upload-manager').then(({ uploadManager }) => {
                uploadManager.addTask(taskId, file.name || '图片', 'current_form');
            });

            try {
                const uploadRes = await uploadFile<{ id: string; url: string }>(
                    API.SALES_UPLOAD(accessToken),
                    file.url
                );

                if (uploadRes.success && uploadRes.data) {
                    this.setData({
                        [`fileList[${index}].status`]: 'done',
                        [`fileList[${index}].url`]: getFileUrl(uploadRes.data.url),
                        [`fileList[${index}].id`]: uploadRes.data.id,
                    });
                    import('../../utils/upload-manager').then(({ uploadManager }) => {
                        uploadManager.setSuccess(taskId, uploadRes.data);
                    });
                } else {
                    this.setData({ [`fileList[${index}].status`]: 'failed' });
                    import('../../utils/upload-manager').then(({ uploadManager }) => {
                        uploadManager.setFailed(taskId, '上传失败');
                    });
                }
            } catch (e) {
                console.error('Upload item failed:', e);
                this.setData({ [`fileList[${index}].status`]: 'failed' });
                import('../../utils/upload-manager').then(({ uploadManager }) => {
                    uploadManager.setFailed(taskId, String(e));
                });
            }
        });

        await Promise.all(uploadTasks);

        // 如果所有图片上传完成且没有失败，关闭退出提醒
        const allDone = this.data.fileList.every(f => f.status === 'done');
        if (allDone && wx.disableAlertBeforeUnload) {
            wx.disableAlertBeforeUnload();
        }
    },

    handleBack() {
        wx.navigateBack();
    },

    async handleSubmit() {
        const { form, fileList } = this.data;
        const accessToken = getAccessToken();
        const Toast = this.selectComponent('#t-toast');

        if (!accessToken) {
            Toast.show({ content: '请先登录', theme: 'warning' });
            return;
        }

        // 增强校验
        const requiredFields: Array<{ key: keyof FormData; label: string }> = [
            { key: 'name', label: '客户名称' },
            { key: 'brand', label: '品牌' }
        ];

        for (const field of requiredFields) {
            if (!form[field.key]?.trim()) {
                Toast.show({ content: `请输入${field.label}`, theme: 'warning' });
                return;
            }
        }

        // 检查上传状态
        if (fileList.some(f => f.status === 'loading')) {
            Toast.show({ content: '图片上传中，请稍候', theme: 'warning' });
            return;
        }

        if (fileList.some(f => f.status === 'failed')) {
            Toast.show({ content: '存在上传失败的图片', theme: 'warning' });
            return;
        }

        this.setData({ submitting: true });

        try {
            const imageIds = fileList.map((f: any) => f.id).filter(Boolean);
            const response = await post(API.SALES_ORDERS(accessToken), {
                ...form,
                images: imageIds,
            });

            if (response.success) {
                Toast.show({ content: '订单创建成功', theme: 'success' });
                setTimeout(() => wx.navigateBack(), 1500);
            } else {
                throw new Error(response.error || '创建失败');
            }
        } catch (error: any) {
            Toast.show({ content: error.message || '提交失败', theme: 'error' });
        } finally {
            this.setData({ submitting: false });
        }
    }
});
