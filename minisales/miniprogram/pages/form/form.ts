/**
 * 订单表单页
 */

// ... (Imports remain same)
import { post, uploadFile, getAccessToken } from '../../utils/api';
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

    async processUpload(files: any[]) {
        const accessToken = getAccessToken();
        if (!accessToken) return;

        const currentFiles = this.data.fileList; // Get latest reference

        for (const file of files) {
            const index = currentFiles.findIndex(f => f.url === file.url);
            if (index === -1) continue;

            try {
                const uploadRes = await uploadFile(API.SALES_UPLOAD(accessToken), file.url); // file.url is tempFilePath
                if (uploadRes.success && uploadRes.data) {
                    this.setData({
                        [`fileList[${index}].status`]: 'done',
                        [`fileList[${index}].url`]: uploadRes.data.url, // Update to remote URL (optional, depends on backend return)
                        // Store the ID somewhere? TDesign file object allows custom props?
                        // We need to store the ID to submit later. 
                        // Let's attach 'id' to the file object in fileList.
                        [`fileList[${index}].id`]: uploadRes.data.id,
                    });
                } else {
                    this.setData({ [`fileList[${index}].status`]: 'failed' });
                }
            } catch (e) {
                this.setData({ [`fileList[${index}].status`]: 'failed' });
            }
        }
    },

    handleBack() {
        wx.navigateBack();
    },

    async handleSubmit() {
        const { form, fileList } = this.data;
        const accessToken = getAccessToken();
        if (!accessToken) {
            // TToast usage via id
            const Toast = this.selectComponent('#t-toast');
            Toast.show({ content: '请先登录', theme: 'warning' });
            return;
        }

        if (!form.name.trim()) {
            const Toast = this.selectComponent('#t-toast');
            Toast.show({ content: '请输入客户名称', theme: 'warning' });
            return;
        }

        // Check if all uploads done
        const uploading = fileList.some(f => f.status === 'loading');
        if (uploading) {
            const Toast = this.selectComponent('#t-toast');
            Toast.show({ content: '图片上传中，请稍候', theme: 'warning' });
            return;
        }

        const failed = fileList.some(f => f.status === 'failed');
        if (failed) {
            const Toast = this.selectComponent('#t-toast');
            Toast.show({ content: '有图片上传失败，请重试或删除', theme: 'warning' });
            return;
        }

        this.setData({ submitting: true });

        try {
            const imageIds = fileList.map((f: any) => f.id).filter(Boolean);

            const orderData = {
                ...form,
                images: imageIds,
            };

            const response = await post(API.SALES_ORDERS(accessToken), orderData);

            if (response.success) {
                const Toast = this.selectComponent('#t-toast');
                Toast.show({ content: '订单创建成功', theme: 'success' });
                setTimeout(() => wx.navigateBack(), 1500);
            } else {
                throw new Error(response.error || '创建失败');
            }
        } catch (error: any) {
            const Toast = this.selectComponent('#t-toast');
            Toast.show({ content: error.message || '提交失败', theme: 'error' });
        } finally {
            this.setData({ submitting: false });
        }
    }
});
