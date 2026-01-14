/**
 * 订单表单页
 */

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

interface ImageItem {
    id?: string;
    tempPath: string;
    url?: string;
    uploading?: boolean;
    uploaded?: boolean;
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
        images: [] as ImageItem[],
        submitting: false,
        uploadProgress: {
            current: 0,
            total: 0,
        },
        // 日期选择器
        minDate: '',
        maxDate: '',
    },

    onLoad(options: { prefill?: string }) {
        // 设置日期范围
        const today = new Date();
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 3);

        this.setData({
            minDate: this.formatDate(today),
            maxDate: this.formatDate(maxDate),
        });

        // 预填充数据 (从复制订单传入)
        if (options.prefill) {
            try {
                const prefill = JSON.parse(decodeURIComponent(options.prefill));
                this.setData({ form: { ...this.data.form, ...prefill } });
            } catch (e) {
                console.error('Parse prefill failed:', e);
            }
        }
    },

    /**
     * 格式化日期
     */
    formatDate(date: Date): string {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    /**
     * 输入处理
     */
    onInput(e: WechatMiniprogram.Input) {
        const { field } = e.currentTarget.dataset;
        this.setData({
            [`form.${field}`]: e.detail.value,
        });
    },

    /**
     * 日期选择
     */
    onDateChange(e: WechatMiniprogram.PickerChange) {
        this.setData({
            'form.deadline': e.detail.value as string,
        });
    },

    /**
     * 选择图片
     */
    async chooseImage() {
        const { images } = this.data;
        const remainCount = 9 - images.length;

        if (remainCount <= 0) {
            wx.showToast({ title: '最多9张图片', icon: 'none' });
            return;
        }

        try {
            const res = await new Promise<WechatMiniprogram.ChooseMediaSuccessCallbackResult>((resolve, reject) => {
                wx.chooseMedia({
                    count: remainCount,
                    mediaType: ['image'],
                    sourceType: ['album', 'camera'],
                    sizeType: ['compressed'],
                    success: resolve,
                    fail: reject,
                });
            });

            const newImages: ImageItem[] = res.tempFiles.map((file) => ({
                tempPath: file.tempFilePath,
                uploading: false,
                uploaded: false,
            }));

            this.setData({
                images: [...images, ...newImages],
            });
        } catch (e) {
            console.log('Choose image cancelled');
        }
    },

    /**
     * 预览图片
     */
    previewImage(e: WechatMiniprogram.TouchEvent) {
        const { index } = e.currentTarget.dataset;
        const urls = this.data.images.map((img) => img.url || img.tempPath);
        wx.previewImage({
            current: urls[index],
            urls,
        });
    },

    /**
     * 删除图片
     */
    removeImage(e: WechatMiniprogram.TouchEvent) {
        const { index } = e.currentTarget.dataset;
        const images = [...this.data.images];
        images.splice(index, 1);
        this.setData({ images });
    },

    /**
     * 提交订单
     */
    async handleSubmit() {
        const { form, images } = this.data;
        const accessToken = getAccessToken();

        if (!accessToken) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            return;
        }

        // 验证必填字段
        if (!form.name.trim()) {
            wx.showToast({ title: '请输入客户名称', icon: 'none' });
            return;
        }

        this.setData({ submitting: true });

        try {
            // 1. 上传未上传的图片
            const uploadedImages: string[] = [];
            const imagesToUpload = images.filter((img) => !img.uploaded);

            this.setData({
                uploadProgress: { current: 0, total: imagesToUpload.length },
            });

            for (let i = 0; i < imagesToUpload.length; i++) {
                const img = imagesToUpload[i];

                this.setData({
                    uploadProgress: { current: i + 1, total: imagesToUpload.length },
                    [`images[${images.indexOf(img)}].uploading`]: true,
                });

                try {
                    const uploadRes = await uploadFile(API.SALES_UPLOAD(accessToken), img.tempPath);
                    if (uploadRes.success && uploadRes.data) {
                        uploadedImages.push(uploadRes.data.id);
                        this.setData({
                            [`images[${images.indexOf(img)}].uploaded`]: true,
                            [`images[${images.indexOf(img)}].id`]: uploadRes.data.id,
                        });
                    }
                } catch (e) {
                    console.error('Upload failed:', e);
                } finally {
                    this.setData({
                        [`images[${images.indexOf(img)}].uploading`]: false,
                    });
                }
            }

            // 加上已上传的图片
            images.forEach((img) => {
                if (img.uploaded && img.id && !uploadedImages.includes(img.id)) {
                    uploadedImages.push(img.id);
                }
            });

            // 2. 创建订单
            const orderData = {
                ...form,
                images: uploadedImages,
            };

            const response = await post(API.SALES_ORDERS(accessToken), orderData, {
                showLoading: true,
                loadingText: '提交中...',
            });

            if (response.success) {
                wx.showToast({ title: '订单创建成功', icon: 'success' });
                setTimeout(() => {
                    wx.navigateBack();
                }, 1500);
            } else {
                wx.showToast({ title: response.error || '创建失败', icon: 'none' });
            }
        } catch (error: any) {
            wx.showToast({ title: error.message || '提交失败', icon: 'none' });
        } finally {
            this.setData({ submitting: false });
        }
    },

    /**
     * 取消
     */
    handleCancel() {
        wx.showModal({
            title: '确认取消',
            content: '确定要放弃本次编辑吗？',
            success: (res) => {
                if (res.confirm) {
                    wx.navigateBack();
                }
            },
        });
    },
});
