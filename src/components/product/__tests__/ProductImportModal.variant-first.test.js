import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ProductImportModal from '../ProductImportModal.vue';

const mocks = vi.hoisted(() => ({
    importProducts: vi.fn(),
    authFetch: vi.fn(),
    addToast: vi.fn(),
    xlsxRead: vi.fn(),
    sheetToJson: vi.fn(),
}));

vi.mock('@/composables/useProducts', () => ({
    useProducts: () => ({
        importProducts: mocks.importProducts,
    }),
}));

vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ addToast: mocks.addToast }),
}));

vi.mock('@/composables/useAuth', () => ({
    useAuth: () => ({ authFetch: mocks.authFetch }),
}));

vi.mock('@/composables/useI18n', () => ({
    useI18n: () => ({ t: (k) => k }),
}));

vi.mock('xlsx', () => ({
    read: mocks.xlsxRead,
    utils: {
        sheet_to_json: mocks.sheetToJson,
    },
}));

describe('ProductImportModal Variant-First Payload', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.importProducts.mockResolvedValue({ success: true, count: 1 });
        mocks.authFetch.mockResolvedValue({
            json: async () => ({ success: true, result: { id: 'img-uploaded' } }),
        });
        mocks.xlsxRead.mockReturnValue({
            SheetNames: ['Sheet1'],
            Sheets: {
                Sheet1: {},
            },
        });
        mocks.sheetToJson.mockReturnValue([
            ['商品名称', 'SKU'],
            ['帽子', 'SKU-HAT'],
        ]);
    });

    it('groups rows by spu and sends variant-first payload', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: {
                        template: '<div><slot></slot><slot name="footer"></slot></div>'
                    },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: {
                modelValue: true
            }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            {
                name: 'T恤',
                spu: 'SPU-1001',
                category: '上装',
                brand: 'KK',
                sku: 'SKU-RED',
                options_values: { 颜色: 'Red' },
                price: 100
            },
            {
                name: 'T恤',
                spu: 'SPU-1001',
                category: '上装',
                brand: 'KK',
                sku: 'SKU-BLUE',
                options_values: { 颜色: 'Blue' },
                price: 110
            },
            {
                name: '裤子',
                spu: '',
                sku: 'SKU-PANT',
                price: 200
            },
            {
                name: '帽子',
                spu: '',
                sku: 'SKU-HAT',
                price: 50
            }
        ];

        await wrapper.vm.handleImport();

        expect(mocks.importProducts).toHaveBeenCalledTimes(1);
        const payload = mocks.importProducts.mock.calls[0][0];
        const options = mocks.importProducts.mock.calls[0][1];
        
        expect(payload).toHaveLength(3);
        expect(options).toMatchObject({ importMode: 'safe_merge' });

        const spuProduct = payload.find(p => p.spu === 'SPU-1001');
        expect(spuProduct).toBeDefined();
        expect(spuProduct.name).toBe('T恤');
        expect(spuProduct.category).toBe('上装');
        expect(spuProduct.variants).toHaveLength(2);
        expect(spuProduct.variants[0].sku).toBe('SKU-RED');
        expect(spuProduct.variants[0].price).toBe(100);
        expect(spuProduct.variants[0].options_values).toEqual({ 颜色: 'Red' });

        const emptySpuProducts = payload.filter(p => !p.spu);
        expect(emptySpuProducts).toHaveLength(2);
        expect(emptySpuProducts[0].variants).toHaveLength(1);
        expect(emptySpuProducts[1].variants).toHaveLength(1);
    });

    it('discards pending import results after modal closes', async () => {
        let resolveImport;
        mocks.importProducts.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveImport = resolve;
                })
        );

        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: {
                modelValue: true
            }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            {
                name: 'T恤',
                spu: 'SPU-1001',
                sku: 'SKU-RED',
                price: 100
            }
        ];

        const pending = wrapper.vm.handleImport();
        await Promise.resolve();
        expect(wrapper.vm.loading).toBe(true);

        await wrapper.setProps({ modelValue: false });
        await wrapper.vm.$nextTick();

        resolveImport({ success: true, count: 1 });
        await pending;

        expect(wrapper.emitted('success')).toBeUndefined();
        expect(wrapper.vm.importResult).toBe(null);
        expect(wrapper.vm.currentStep).toBe(1);
    });

    it('discards pending image upload results after modal closes', async () => {
        let resolveUpload;
        mocks.authFetch.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveUpload = resolve;
                })
        );

        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: {
                modelValue: true
            }
        });

        wrapper.vm.currentStep = 5;
        wrapper.vm.parsedItems = [
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', image_url: 'a.jpg' }
        ];
        wrapper.vm.imageMatches = new Map([
            ['spu:SPU-1001', new File(['a'], 'a.jpg', { type: 'image/jpeg' })]
        ]);

        const pending = wrapper.vm.handleUploadImagesAndNext();
        await Promise.resolve();
        expect(wrapper.vm.loading).toBe(true);

        await wrapper.setProps({ modelValue: false });
        await wrapper.vm.$nextTick();

        resolveUpload({
            json: async () => ({ success: true, result: { id: 'img-late' } }),
        });
        await pending;

        expect(wrapper.vm.currentStep).toBe(1);
        expect(wrapper.vm.parsedItems).toEqual([]);
        expect(wrapper.vm.loading).toBe(false);
    });

    it('clears matched image state after the modal closes', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: {
                modelValue: true
            }
        });

        wrapper.vm.currentStep = 5;
        wrapper.vm.parsedItems = [
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', image_url: 'a.jpg' }
        ];
        wrapper.vm.imageUploadFiles = [new File(['a'], 'a.jpg', { type: 'image/jpeg' })];
        wrapper.vm.imageMatches = new Map([
            ['spu:SPU-1001', new File(['a'], 'a.jpg', { type: 'image/jpeg' })]
        ]);

        await wrapper.setProps({ modelValue: false });
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.currentStep).toBe(1);
        expect(wrapper.vm.imageUploadFiles).toEqual([]);
        expect(wrapper.vm.imageMatches.size).toBe(0);
    });

    it('keeps image-match step open when all matched image uploads fail', async () => {
        mocks.authFetch.mockResolvedValue({
            json: async () => ({ success: false, error: 'upload failed' }),
        });

        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: {
                modelValue: true
            }
        });

        wrapper.vm.currentStep = 5;
        wrapper.vm.parsedItems = [
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', image_url: 'a.jpg' }
        ];
        wrapper.vm.imageMatches = new Map([
            ['spu:SPU-1001', new File(['a'], 'a.jpg', { type: 'image/jpeg' })]
        ]);

        await wrapper.vm.handleUploadImagesAndNext();

        expect(wrapper.vm.currentStep).toBe(5);
        expect(mocks.addToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' })
        );
    });

    it('warns when only part of the matched images upload successfully', async () => {
        mocks.authFetch
            .mockResolvedValueOnce({
                json: async () => ({ success: true, result: { id: 'img-ok' } }),
            })
            .mockResolvedValueOnce({
                json: async () => ({ success: false, error: 'upload failed' }),
            });

        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: {
                modelValue: true
            }
        });

        wrapper.vm.currentStep = 5;
        wrapper.vm.parsedItems = [
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', image_url: 'a.jpg' },
            { name: 'T恤', spu: 'SPU-1002', sku: 'SKU-BLUE', image_url: 'b.jpg' }
        ];
        wrapper.vm.imageMatches = new Map([
            ['spu:SPU-1001', new File(['a'], 'a.jpg', { type: 'image/jpeg' })],
            ['spu:SPU-1002', new File(['b'], 'b.jpg', { type: 'image/jpeg' })]
        ]);

        await wrapper.vm.handleUploadImagesAndNext();

        expect(wrapper.vm.currentStep).toBe(4);
        expect(mocks.addToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'warning' })
        );
        expect(mocks.addToast).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' })
        );
    });

    it('returns from image matching to mapping without clearing parsed data', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.currentStep = 5;
        wrapper.vm.parsedItems = [
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', image_url: 'a.jpg' }
        ];
        wrapper.vm.preprocessStats = {
            sourceRows: 1,
            acceptedRows: 1,
            droppedEmptyRows: 0,
            normalizedRows: 0,
        };

        wrapper.vm.handleBack();

        expect(wrapper.vm.currentStep).toBe(3);
        expect(wrapper.vm.parsedItems).toEqual([
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', image_url: 'a.jpg' }
        ]);
        expect(wrapper.vm.preprocessStats.acceptedRows).toBe(1);
    });

    it('returns from preview to image matching when image workflow is active', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', images: ['img-uploaded'] }
        ];
        wrapper.vm.preprocessStats = {
            sourceRows: 1,
            acceptedRows: 1,
            droppedEmptyRows: 0,
            normalizedRows: 0,
        };
        wrapper.vm.imageUploadFiles = [new File(['a'], 'a.jpg', { type: 'image/jpeg' })];
        wrapper.vm.imageMatches = new Map([
            ['spu:SPU-1001', new File(['a'], 'a.jpg', { type: 'image/jpeg' })]
        ]);

        wrapper.vm.handleBack();

        expect(wrapper.vm.currentStep).toBe(5);
        expect(wrapper.vm.parsedItems).toEqual([
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', images: ['img-uploaded'] }
        ]);
        expect(wrapper.vm.preprocessStats.acceptedRows).toBe(1);
    });

    it('builds grouped product payload with currency and derived dimensions', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            {
                name: '风衣',
                spu: 'SPU-DIM-1',
                category: '外套',
                brand: 'KK',
                currency: 'USD',
                sku: 'SKU-DIM-RED-M',
                options_values: { 颜色: 'Red', 尺寸: 'M' },
                price: 100,
            },
            {
                name: '风衣',
                spu: 'SPU-DIM-1',
                category: '外套',
                brand: 'KK',
                currency: 'USD',
                sku: 'SKU-DIM-BLUE-L',
                options_values: { 颜色: 'Blue', 尺寸: 'L' },
                price: 120,
            },
        ];

        await wrapper.vm.handleImport();

        const payload = mocks.importProducts.mock.calls[0][0];
        expect(payload).toHaveLength(1);
        expect(payload[0]).toMatchObject({
            name: '风衣',
            spu: 'SPU-DIM-1',
            currency: 'USD',
        });
        expect(payload[0].dimensions).toEqual([
            { name: '颜色', values: ['Red', 'Blue'] },
            { name: '尺寸', values: ['M', 'L'] },
        ]);
    });

    it('omits unresolved local image filenames from imported variant payloads', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            {
                name: '风衣',
                spu: 'SPU-IMG-1',
                sku: 'SKU-IMG-1',
                price: 100,
                cost_price: 50,
                stock_quantity: 10,
                alert_threshold: 2,
                status: 'active',
                image_url: 'local-only.jpg',
            },
        ];

        await wrapper.vm.handleImport();

        const payload = mocks.importProducts.mock.calls.at(-1)[0];
        expect(payload[0].variants[0]).not.toHaveProperty('image_url');
    });

    it('maps extended import fields and keeps mapped status', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: {
                        template: '<div><slot></slot><slot name="footer"></slot></div>'
                    },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: {
                modelValue: true
            }
        });

        wrapper.vm.fileHeaders = ['商品名称', 'SPU', 'SKU', '变体编码', '条码', '供应商SKU', '状态', '币种'];
        wrapper.vm.rawFileRows = [['短袖', 'SPU-1', 'SKU-1', 'V-1', '6900001', 'SUP-1', 'archived', 'USD']];
        wrapper.vm.fieldMapping = {
            name: '商品名称',
            spu: 'SPU',
            sku: 'SKU',
            variant_code: '变体编码',
            barcode: '条码',
            supplier_sku: '供应商SKU',
            status: '状态',
            currency: '币种',
        };
        wrapper.vm.specConfigs = [];

        wrapper.vm.handleConfirmMapping();

        expect(wrapper.vm.parsedItems).toHaveLength(1);
        expect(wrapper.vm.parsedItems[0]).toMatchObject({
            name: '短袖',
            spu: 'SPU-1',
            sku: 'SKU-1',
            variant_code: 'V-1',
            barcode: '6900001',
            supplier_sku: 'SUP-1',
            status: 'archived',
            currency: 'USD',
        });
    });

    it('sanitizes numeric fields and status/currency during mapping', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.fileHeaders = ['商品名称', 'SKU', '售价', '库存数', '状态', '币种'];
        wrapper.vm.rawFileRows = [['  冲锋衣  ', ' SKU-888 ', '1,299.5', ' 10 ', ' 上架 ', ' cny ']];
        wrapper.vm.fieldMapping = {
            name: '商品名称',
            sku: 'SKU',
            price: '售价',
            stock_quantity: '库存数',
            status: '状态',
            currency: '币种',
        };
        wrapper.vm.specConfigs = [];

        wrapper.vm.handleConfirmMapping();
        expect(wrapper.vm.parsedItems).toHaveLength(1);
        expect(wrapper.vm.parsedItems[0]).toMatchObject({
            name: '冲锋衣',
            sku: 'SKU-888',
            price: 1299.5,
            stock_quantity: 10,
            status: 'active',
            currency: 'CNY',
        });
        expect(wrapper.vm.preprocessStats).toMatchObject({
            sourceRows: 1,
            acceptedRows: 1,
            droppedEmptyRows: 0,
            normalizedRows: 1,
        });
    });

    it('maps inactive-like statuses to archived and blocks unsupported statuses early', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.fileHeaders = ['商品名称', 'SKU', '状态'];
        wrapper.vm.rawFileRows = [['冲锋衣', 'SKU-ARCHIVE', '下架']];
        wrapper.vm.fieldMapping = {
            name: '商品名称',
            sku: 'SKU',
            status: '状态',
        };
        wrapper.vm.specConfigs = [];
        wrapper.vm.handleConfirmMapping();
        expect(wrapper.vm.parsedItems[0].status).toBe('archived');

        mocks.addToast.mockClear();
        wrapper.vm.rawFileRows = [['冲锋衣', 'SKU-INVALID', 'paused']];
        wrapper.vm.parsedItems = [];
        wrapper.vm.handleConfirmMapping();
        expect(mocks.addToast).toHaveBeenCalled();
        expect(wrapper.vm.parsedItems).toHaveLength(0);
        expect(wrapper.vm.mappingValidationReport?.byCode?.invalid_status).toBe(1);
    });

    it('maps custom spec names into options_values and blocks duplicate names', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.fileHeaders = ['商品名称', 'SPU', 'SKU', '版型', '适配场景'];
        wrapper.vm.rawFileRows = [['冲锋衣', 'SPU-2', 'SKU-2', '宽松', '户外']];
        wrapper.vm.fieldMapping = { name: '商品名称', spu: 'SPU', sku: 'SKU' };
        wrapper.vm.specConfigs = [
            { id: 's1', name: '版型', column: '版型' },
            { id: 's2', name: '场景', column: '适配场景' },
        ];

        wrapper.vm.handleConfirmMapping();
        expect(wrapper.vm.parsedItems[0].options_values).toEqual({ 版型: '宽松', 场景: '户外' });

        wrapper.vm.specConfigs = [
            { id: 's1', name: '尺寸', column: '版型' },
            { id: 's2', name: ' 尺寸 ', column: '适配场景' },
        ];
        wrapper.vm.parsedItems = [];
        wrapper.vm.handleConfirmMapping();
        expect(mocks.addToast).toHaveBeenCalled();
        expect(wrapper.vm.parsedItems).toHaveLength(0);
    });

    it('blocks confirm when sku mapping missing or sku value empty', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.fileHeaders = ['商品名称', 'SPU'];
        wrapper.vm.rawFileRows = [['冲锋衣', 'SPU-3']];
        wrapper.vm.fieldMapping = { name: '商品名称', spu: 'SPU' };
        wrapper.vm.specConfigs = [];
        wrapper.vm.handleConfirmMapping();
        expect(mocks.addToast).toHaveBeenCalled();
        expect(wrapper.vm.parsedItems).toHaveLength(0);

        wrapper.vm.fileHeaders = ['商品名称', 'SPU', 'SKU'];
        wrapper.vm.rawFileRows = [['冲锋衣', 'SPU-3', '']];
        wrapper.vm.fieldMapping = { name: '商品名称', spu: 'SPU', sku: 'SKU' };
        wrapper.vm.handleConfirmMapping();
        expect(mocks.addToast).toHaveBeenCalled();
        expect(wrapper.vm.parsedItems).toHaveLength(0);
        expect(wrapper.vm.mappingValidationReport).toBeTruthy();
        expect(wrapper.vm.mappingValidationReport.byCode.missing_sku).toBe(1);
    });

    it('blocks confirm when duplicated sku exists in mapped rows', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.fileHeaders = ['商品名称', 'SKU'];
        wrapper.vm.rawFileRows = [
            ['冲锋衣', 'SKU-DUP-1'],
            ['羽绒服', ' SKU-DUP-1 '],
        ];
        wrapper.vm.fieldMapping = { name: '商品名称', sku: 'SKU' };
        wrapper.vm.specConfigs = [];
        wrapper.vm.handleConfirmMapping();

        expect(mocks.addToast).toHaveBeenCalled();
        expect(wrapper.vm.parsedItems).toHaveLength(0);
        expect(wrapper.vm.mappingValidationReport).toBeTruthy();
        expect(wrapper.vm.mappingValidationReport.byCode.duplicate_sku).toBeGreaterThanOrEqual(1);
    });

    it('blocks confirm when repeated product names have no spu for safe grouping', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.fileHeaders = ['商品名称', 'SKU'];
        wrapper.vm.rawFileRows = [
            ['冲锋衣', 'SKU-NO-SPU-1'],
            [' 冲锋衣 ', 'SKU-NO-SPU-2'],
        ];
        wrapper.vm.fieldMapping = { name: '商品名称', sku: 'SKU' };
        wrapper.vm.specConfigs = [];

        wrapper.vm.handleConfirmMapping();

        expect(mocks.addToast).toHaveBeenCalled();
        expect(wrapper.vm.parsedItems).toHaveLength(0);
        expect(wrapper.vm.mappingValidationReport).toBeTruthy();
        expect(wrapper.vm.mappingValidationReport.byCode.duplicate_name_without_spu).toBe(2);
    });

    it('blocks confirm when product name is empty in source rows', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.fileHeaders = ['商品名称', 'SKU'];
        wrapper.vm.rawFileRows = [['', 'SKU-001']];
        wrapper.vm.fieldMapping = { name: '商品名称', sku: 'SKU' };
        wrapper.vm.specConfigs = [];
        wrapper.vm.handleConfirmMapping();

        expect(mocks.addToast).toHaveBeenCalled();
        expect(wrapper.vm.parsedItems).toHaveLength(0);
    });

    it('aggregates backend summary and uses grouped item count for progress total', async () => {
        mocks.importProducts.mockResolvedValue({
            success: true,
            count: 2,
            summary: {
                createdProducts: 1,
                updatedProducts: 1,
                createdVariants: 1,
                updatedVariants: 1,
                conflicts: 1,
            },
            conflicts: [{ batch: 1, level: 'variant', spu: 'SPU-1001', sku: 'SKU-RED', field: 'price', current: 100, incoming: 110 }],
        });

        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: {
                        template: '<div><slot></slot><slot name="footer"></slot></div>'
                    },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: {
                modelValue: true
            }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', price: 100 },
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-BLUE', price: 110 },
            { name: '帽子', spu: '', sku: 'SKU-HAT', price: 50 }
        ];

        await wrapper.vm.handleImport();

        expect(wrapper.vm.importStats.total).toBe(2); // grouped by spu + empty-spu row key
        expect(wrapper.vm.importResult.summary).toEqual({
            createdProducts: 1,
            updatedProducts: 1,
            createdVariants: 1,
            updatedVariants: 1,
            conflicts: 1,
        });
        expect(wrapper.vm.importResult.conflicts).toHaveLength(1);
        expect(wrapper.emitted('success')).toBeTruthy();
    });

    it('surfaces partial batch failures even when backend returns success=true', async () => {
        mocks.importProducts.mockResolvedValue({
            success: true,
            count: 1,
            summary: {
                createdProducts: 1,
                updatedProducts: 0,
                createdVariants: 1,
                updatedVariants: 0,
                conflicts: 0,
                failedProducts: 1,
            },
            errors: ['Failed to process item SPU-ERR: invalid status'],
        });

        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            { name: 'T恤', spu: 'SPU-S-1', sku: 'SKU-S-1', price: 100 },
            { name: '帽子', spu: 'SPU-S-2', sku: 'SKU-S-2', price: 50 },
        ];

        await wrapper.vm.handleImport();

        expect(wrapper.vm.importResult.success).toBe(true);
        expect(wrapper.vm.importResult.failed).toBe(1);
        expect(wrapper.vm.importResult.errors).toContain('Failed to process item SPU-ERR: invalid status');
        expect(wrapper.emitted('success')).toBeTruthy();
    });

    it('passes replace mode to batch import request when user selects full overwrite', async () => {
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.importMode = 'replace';
        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [{ name: '帽子', spu: '', sku: 'SKU-HAT', price: 50 }];

        await wrapper.vm.handleImport();

        expect(mocks.importProducts).toHaveBeenCalledTimes(1);
        expect(mocks.importProducts.mock.calls[0][1]).toMatchObject({ importMode: 'replace' });
    });

    it('does not treat zero-count success responses as a fully successful chunk', async () => {
        mocks.importProducts.mockResolvedValue({
            success: true,
            count: 0,
            summary: {
                createdProducts: 0,
                updatedProducts: 0,
                createdVariants: 0,
                updatedVariants: 0,
                conflicts: 0,
                failedProducts: 2,
            },
            errors: ['SPU-1 failed', 'SPU-2 failed'],
        });

        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            { name: 'A', spu: 'SPU-1', sku: 'SKU-1', price: 100 },
            { name: 'B', spu: 'SPU-2', sku: 'SKU-2', price: 200 },
        ];

        await wrapper.vm.handleImport();

        expect(wrapper.vm.importResult.success).toBe(false);
        expect(wrapper.vm.importResult.count).toBe(0);
        expect(wrapper.vm.importResult.failed).toBe(2);
        expect(wrapper.emitted('success')).toBeFalsy();
    });

    it('preserves conflict-only batch results instead of treating them as full failures', async () => {
        mocks.importProducts.mockResolvedValue({
            success: false,
            count: 0,
            summary: {
                createdProducts: 0,
                updatedProducts: 0,
                createdVariants: 0,
                updatedVariants: 0,
                conflicts: 1,
                failedProducts: 0,
            },
            conflicts: [
                {
                    batch: 1,
                    level: 'variant',
                    spu: 'SPU-1001',
                    sku: 'SKU-RED',
                    field: 'price',
                    current: 100,
                    incoming: 120,
                },
            ],
            errors: [],
        });

        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        wrapper.vm.currentStep = 4;
        wrapper.vm.parsedItems = [
            { name: 'T恤', spu: 'SPU-1001', sku: 'SKU-RED', price: 120 },
        ];

        await wrapper.vm.handleImport();

        expect(wrapper.vm.importResult.success).toBe(false);
        expect(wrapper.vm.importResult.failed).toBe(0);
        expect(wrapper.vm.importResult.summary.conflicts).toBe(1);
        expect(wrapper.vm.importResult.conflicts).toEqual([
            expect.objectContaining({
                batch: 1,
                spu: 'SPU-1001',
                sku: 'SKU-RED',
                field: 'price',
            }),
        ]);
        expect(wrapper.vm.importStats.failed).toBe(0);
        expect(wrapper.emitted('success')).toBeFalsy();
        expect(mocks.addToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'warning' })
        );
    });

    it('discards pending file parse results after modal closes', async () => {
        let resolveArrayBuffer;
        const wrapper = mount(ProductImportModal, {
            global: {
                stubs: {
                    Modal: { template: '<div><slot></slot><slot name="footer"></slot></div>' },
                    AppIcon: true,
                    ImportUploadStep: true,
                    ImportMappingStep: true,
                    ImportImageMatchStep: true,
                    ImportPreviewStep: true
                }
            },
            props: { modelValue: true }
        });

        const fakeFile = {
            name: 'products.xlsx',
            size: 128,
            arrayBuffer: vi.fn(() => new Promise((resolve) => {
                resolveArrayBuffer = resolve;
            })),
        };

        const pending = wrapper.vm.processFile(fakeFile);
        await Promise.resolve();

        await wrapper.setProps({ modelValue: false });
        await wrapper.vm.$nextTick();

        resolveArrayBuffer(new ArrayBuffer(8));
        await pending;

        expect(wrapper.vm.currentStep).toBe(1);
        expect(wrapper.vm.fileName).toBe('');
        expect(wrapper.vm.rawFileRows).toEqual([]);
        expect(wrapper.vm.fileHeaders).toEqual([]);
    });
});
