// Removed unused imports

import eventBus from './eventBus.js';
import UIHandlersModule from './ui-handlers.js';
import ConfirmModal from '../components/ConfirmModal.js';

export class InventoryModule {
    constructor(app) {
        this.app = app;
        this.apiBaseUrl = app.API_BASE;
        this.eventBus = eventBus;
        this.modal = document.getElementById('inventoryRecordModal');
        this.form = document.getElementById('inventoryRecordForm');
        this.modalTitle = document.getElementById('inventoryRecordModalTitle');
        this.recordTypeInput = document.getElementById('recordType');
        this.itemNameInput = document.getElementById('recordItemName');
        this.itemIdInput = document.getElementById('recordItemId');
        this.recordLocationInput = document.getElementById('recordLocation');
        this.quantityInput = document.getElementById('recordQuantity');
        this.reasonInput = document.getElementById('recordReason');
        this.dateInput = document.getElementById('recordDate');
        this.itemNameList = document.getElementById('itemNameList');
        this.itemIdList = document.getElementById('itemIdList');
        this.currentQuantityValue = document.getElementById('currentQuantityValue');
        this.inventoryTableBody = document.getElementById('inventoryTableBody');
        this.items = []; // 存储所有物品数据
        this.storageUnits = []; // 存储所有容器数据
        
        // 初始化确认模态框
        this.deleteConfirmModal = new ConfirmModal(
            'confirmModal',
            'confirmOk',
            'confirmCancel'
        );
        
        this.loadItems(); // 加载物品和容器数据
        
        // 绑定上下文到处理方法
        this.handleSubmit = this.handleSubmit.bind(this);
        
        // 订阅数据更新事件
        this.eventBus.subscribe('data-updated', () => {
            this.loadInventoryRecords();
        });
    }
    
    showInventory() {
        UIHandlersModule.hideAllContentSections();
        UIHandlersModule.updateActiveMenuItem('inventoryMenu');
        
        // 直接操作DOM元素
        const breadcrumbSection = document.getElementById('breadcrumbSection');
        if (breadcrumbSection) {
            breadcrumbSection.style.display = 'none';
        }
        
        const contentSection = document.querySelector('.content-section');
        if (contentSection) {
            contentSection.style.display = 'none';
        }
        
        const inventorySection = document.getElementById('inventorySection');
        if (inventorySection) {
            inventorySection.style.display = 'block';
        }
        
        this.initInventoryPage();
        console.log('📋 显示库存管理页面');
    }
    
    initInventoryPage() {
        // 绑定事件
        this.bindInventoryEvents();
        // 加载库存记录
        this.loadInventoryRecords();
    }
    
    bindInventoryEvents() {
        // 入库按钮事件
        document.getElementById('addInRecordBtn')?.addEventListener('click', () => {
            this.openInventoryRecordModal('in');
        });
        
        // 出库按钮事件
        document.getElementById('addOutRecordBtn')?.addEventListener('click', () => {
            this.openInventoryRecordModal('out');
        });
        
        // 表单提交事件
        // 先移除旧的事件监听器
        this.form?.removeEventListener('submit', this.handleSubmit);
        // 再添加新的事件监听器
        this.form?.addEventListener('submit', this.handleSubmit);
        
        // 关闭模态框事件
        document.querySelector('#inventoryRecordModal .modal-close')?.addEventListener('click', () => {
            this.closeInventoryRecordModal();
        });
        
        // 点击模态框外部关闭
        this.modal?.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeInventoryRecordModal();
            }
        });
        
        // 物品名称输入事件
        this.itemNameInput?.addEventListener('input', (e) => {
            this.syncItemIdFromName(e.target.value);
        });
        
        // 物品ID输入事件
        this.itemIdInput?.addEventListener('input', (e) => {
            this.syncItemNameFromId(e.target.value);
        });
        
        // 物品ID变化事件（用于datalist选择）
        this.itemIdInput?.addEventListener('change', (e) => {
            this.syncItemNameFromId(e.target.value);
        });
    }

    // 处理表单提交事件
    handleSubmit(e) {
        e.preventDefault();
        this.submitInventoryRecord();
    }
    
    // 加载物品数据
    async loadItems() {
        try {
            // 同时获取物品和容器数据
            const [itemsResponse, storageUnitsResponse] = await Promise.all([
                fetch(`${this.apiBaseUrl}/items`),
                fetch(`${this.apiBaseUrl}/storage_units`)
            ]);
            
            // 检查响应是否成功
            if (!itemsResponse.ok) {
                throw new Error(`获取物品数据失败: HTTP error! status: ${itemsResponse.status}`);
            }
            
            if (!storageUnitsResponse.ok) {
                throw new Error(`获取容器数据失败: HTTP error! status: ${storageUnitsResponse.status}`);
            }
            
            const itemsResult = await itemsResponse.json();
            const storageUnitsResult = await storageUnitsResponse.json();
            
            this.items = itemsResult.success && itemsResult.data ? itemsResult.data : [];
            this.storageUnits = storageUnitsResult.success && storageUnitsResult.data ? storageUnitsResult.data : [];
            
            // 填充datalist
            this.populateItemDatalists();
        } catch (error) {
            console.error('获取数据失败:', error);
            // 确保即使出错也有默认空数组
            this.items = [];
            this.storageUnits = [];
        }
    }
    
    // 容器数据已通过loadItems方法获取，无需单独加载
    
    // 填充物品名称和ID的datalist
    populateItemDatalists() {
        // 清空现有选项
        this.itemNameList.innerHTML = '';
        this.itemIdList.innerHTML = '';
        
        // 去重物品名称
        const uniqueItemNames = [...new Set(this.items.map(item => item.name))];
        
        // 添加物品名称选项
        uniqueItemNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            this.itemNameList.appendChild(option);
        });
        
        // 添加物品ID选项
        this.items.forEach(item => {
            const option = document.createElement('option');
            option.value = item._id;
            this.itemIdList.appendChild(option);
        });
    }
    
    // 从物品名称同步物品ID
    syncItemIdFromName(itemName) {
        // 空值检查
        if (!itemName || !this.itemIdList || !this.itemIdInput || !this.recordLocationInput) {
            return;
        }
        
        // 过滤出匹配的物品
        const matchedItems = this.items.filter(item => item.name.includes(itemName));
        
        // 更新物品ID的datalist
        this.itemIdList.innerHTML = '';
        matchedItems.forEach(item => {
            const option = document.createElement('option');
            option.value = item._id;
            this.itemIdList.appendChild(option);
        });
        
        // 如果只有一个匹配项，自动填充物品ID并更新位置
        if (matchedItems.length === 1) {
            this.itemIdInput.value = matchedItems[0]._id;
            this.updateLocation(matchedItems[0]._id);
        } else {
            this.itemIdInput.value = '';
            this.recordLocationInput.value = '';
        }
    }
    
    // 从物品ID同步物品名称
    syncItemNameFromId(itemId) {
        const matchedItem = this.items.find(item => item._id === itemId);
        if (matchedItem) {
            this.itemNameInput.value = matchedItem.name;
            this.updateLocation(itemId); // 更新位置信息
        } else {
            this.itemNameInput.value = '';
            this.recordLocationInput.value = '';
        }
    }
    
    // 更新位置信息
    updateLocation(itemId) {
        if (!itemId) {
            this.recordLocationInput.value = '';
            if (this.currentQuantityValue) {
                this.currentQuantityValue.textContent = '0';
            }
            return;
        }
        const matchedItem = this.items.find(item => item._id === itemId);
        if (matchedItem) {
            // 更新位置
            const storageUnit = this.storageUnits.find(unit => unit._id === matchedItem.storageUnitId);
            if (storageUnit) {
                this.recordLocationInput.value = storageUnit.name;
            } else {
                this.recordLocationInput.value = '';
                console.warn('未找到匹配的容器数据:', matchedItem.storageUnitId);
            }
            // 更新现有数量
            if (this.currentQuantityValue) {
                const currentQuantity = matchedItem.quantity || matchedItem.stock || 0;
                this.currentQuantityValue.textContent = currentQuantity;
            }
        } else {
            this.recordLocationInput.value = '';
            if (this.currentQuantityValue) {
                this.currentQuantityValue.textContent = '0';
            }
            console.warn('未找到匹配的物品数据:', itemId);
        }
    }
    
    // 验证物品ID是否存在
    validateItemId(itemId) {
        return this.items.some(item => item._id === itemId);
    }
    
    openInventoryRecordModal(type, itemId = null) {
        if (!this.modal || !this.modalTitle || !this.recordTypeInput) return;
        
        // 设置模态框标题
        this.modalTitle.textContent = type === 'in' ? '添加入库记录' : '添加出库记录';
        
        // 清空表单
        this.form?.reset();
        
        // 设置默认日期
        const today = new Date().toISOString().split('T')[0];
        this.dateInput?.setAttribute('value', today);
        
        // 设置记录类型
        this.recordTypeInput.value = type;
        
        // 设置数量输入框的最小值
        this.quantityInput?.setAttribute('min', '1');
        
        // 显示模态框
        this.modal.style.display = 'flex';

        // 自动聚焦到物品名称输入框
        setTimeout(() => {
            document.getElementById('recordItemName').focus();
        }, 100);
        
        // 确保物品数据已加载
        if (this.items.length === 0) {
            this.loadItems().then(() => {
                // 数据加载完成后设置物品ID
                if (itemId && this.itemIdInput) {
                    this.itemIdInput.value = itemId;
                    this.itemIdInput.readOnly = true;
                    this.syncItemNameFromId(itemId); // 同步物品名称和位置信息
                    this.itemNameInput.readOnly = true;
                    // 自动填充原因信息
                    this.reasonInput.value = type === 'in' ? '购入新增' : '使用';
                }
                
                // 更新datalist
                this.populateItemDatalists();
            });
        } else {
            // 设置物品ID（如果提供）
            if (itemId && this.itemIdInput) {
                this.itemIdInput.value = itemId;
                this.itemIdInput.readOnly = true;
                this.syncItemNameFromId(itemId); // 同步物品名称和位置信息
                this.itemNameInput.readOnly = true;
                // 自动填充原因信息
                this.reasonInput.value = type === 'in' ? '购入新增' : '使用';
            }
            
            // 更新datalist
            this.populateItemDatalists();
        }
    }
    
    closeInventoryRecordModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
        // 重置输入框的只读属性
        if (this.itemIdInput) {
            this.itemIdInput.readOnly = false;
        }
        if (this.itemNameInput) {
            this.itemNameInput.readOnly = false;
        }
    }
    
    async submitInventoryRecord() {
        if (!this.form) return;
        
        // 获取表单数据
        const formData = new FormData(this.form);
        const record = Object.fromEntries(formData.entries());
        // 将数量转换为数字类型
        record.quantity = Number(record.quantity);
        // 验证数量是否有效
        const quantityError = document.getElementById('quantityError') || document.createElement('div');
        quantityError.className = 'error-message';
        quantityError.id = 'quantityError';
        
        if (isNaN(record.quantity) || record.quantity <= 0) {
            quantityError.textContent = '数量必须是大于0的数字';
            this.form.appendChild(quantityError);
            return;
        }
        
        // 清除之前的错误提示
        const existingQuantityError = document.getElementById('quantityError');
        if (existingQuantityError) {
            existingQuantityError.remove();
        }
        
        const itemIdError = document.getElementById('itemIdError');
        
        // 验证物品ID是否存在
        if (itemIdError) {
            if (!this.validateItemId(record.itemId)) {
                itemIdError.textContent = 'ID不存在';
                return;
            }
            itemIdError.textContent = '';
        } else {
            console.warn('itemIdError元素未找到');
            // 即使没有错误元素，也要验证ID是否存在
            if (!this.validateItemId(record.itemId)) {
                alert('物品ID不存在');
                return;
            }
        }
        
        try {
            // 发送请求
            const response = await fetch(`${this.apiBaseUrl}/inventory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(record),
            });
            
            const result = await response.json();
            if (result.success) {
                alert('库存记录添加成功');
                this.closeInventoryRecordModal();
                this.loadInventoryRecords();
                // 刷新当前视图，确保物品列表自动更新
                // 通知事件总线刷新视图，不再依赖app实例
                eventBus.publish('refresh-view');
            } else {
                alert('库存记录添加失败: ' + result.message);
            }
        } catch (error) {
            // 忽略net::ERR_ABORTED错误，这通常是由于页面导航或请求中断导致，不影响实际功能
            if (!error.message.includes('net::ERR_ABORTED')) {
                console.error('添加库存记录失败:', error);
                alert('添加库存记录失败，请稍后重试');
            }
        }
    }
    
    async loadInventoryRecords() {
        try {
            // 确保物品数据已加载完成
            await this.loadItems();
            
            const url = `${this.apiBaseUrl}/inventory`;
            console.log('请求库存记录URL:', url);
            
            const response = await fetch(url);
            console.log('响应状态:', response.status);
            
            // 检查响应是否成功
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('响应数据:', result);
            
            if (result.success && result.data) {
                this.renderInventoryRecords(result.data);
            } else {
                console.error('加载库存记录失败:', result.message || '未知错误');
                this.renderInventoryRecords([]); // 显示空状态
            }
        } catch (error) {
            // 忽略net::ERR_ABORTED错误，这通常是由于页面导航或请求中断导致，不影响实际功能
            if (!error.message.includes('net::ERR_ABORTED')) {
                console.error('加载库存记录失败:', error);
                this.renderInventoryRecords([]); // 确保在错误情况下也能显示空状态
            }
        }
    }
    
    renderInventoryRecords(records) {
        if (!this.inventoryTableBody) return;
        
        // 清空表格
        this.inventoryTableBody.innerHTML = '';
        
        if (records.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="8">暂无库存记录</td>';
            this.inventoryTableBody.appendChild(row);
            return;
        }
        
        // 渲染记录
        records.forEach(record => {
            const row = document.createElement('tr');
            
            // 查找物品名称
            const itemName = this.items.find(item => item._id === record.itemId)?.name || '未知物品';

            // 直接从record.status获取出入库类型
            const isIn = record.status === 'in';
            const typeText = isIn ? '入库' : '出库';
            const typeClass = isIn ? 'type-in' : 'type-out';

            // 格式化时间
            const recordTime = new Date(record.timestamp).toLocaleString();

            // 计算变化值
            // 入库时，变化值为 newValue - oldValue
            // 出库时，变化值为 oldValue - newValue
            const changeValue = isIn ? record.newValue - record.oldValue : record.oldValue - record.newValue;

            row.innerHTML = `
                <td>${record._id ? record._id.toString() : ''}</td>
                <td><span class="${typeClass}">${typeText}</span></td>
                <td>${record.itemId || ''}</td>
                <td>${itemName}</td>
                <td>${changeValue}</td>
                <td>${record.reason || ''}</td>
                <td>${recordTime}</td>
                <td>
                    <button class="btn btn-danger btn-sm delete-record-btn" data-record-id="${record._id ? record._id.toString() : ''}">删除记录</button>
                </td>
            `;
            
            this.inventoryTableBody.appendChild(row);
            
            // 为删除按钮添加事件监听
            const deleteBtn = row.querySelector('.delete-record-btn');
            deleteBtn.addEventListener('click', () => this.deleteRecord(record._id));
        });
    }

    /**
     * 删除库存记录
     * @param {string} recordId - 记录ID
     */
    async deleteRecord(recordId) {
        // 使用通用模态框组件
        this.deleteConfirmModal.show({
            title: '确认删除',
            message: '确定要删除这条库存记录吗？此操作不可撤销。',
            context: recordId,
            onConfirm: this.performDeleteRecord.bind(this),
            onCancel: () => console.log('删除操作已取消')
        });
    }

    /**
     * 执行删除库存记录的实际操作
     * @param {string} recordId - 记录ID
     */
    async performDeleteRecord(recordId) {
        if (!recordId) {
            console.error('删除失败：记录ID不能为空');
            alert('删除失败：记录ID无效');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/inventory/${recordId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorMessage = response.status === 404 ? '记录不存在' : `网络错误: ${response.status}`;
                throw new Error(errorMessage);
            }

            const result = await response.json();

            if (!result.success) {
                alert(result.message || '删除失败');
                return;
            }

            // 重新加载记录
            await this.loadInventoryRecords();
            
            // 可选：提供成功反馈
            console.log('库存记录删除成功');

        } catch (error) {
            console.error('删除库存记录失败:', error);
            alert(`删除库存记录失败: ${error.message || '请重试'}`);
        }
    }
    
    /**
     * 销毁模块，清理事件监听器和资源
     */
    destroy() {
        // 销毁确认模态框组件
        if (this.deleteConfirmModal && typeof this.deleteConfirmModal.destroy === 'function') {
            this.deleteConfirmModal.destroy();
        }
        
        // 清理引用，帮助垃圾回收
        this.items = null;
        this.storageUnits = null;
        this.inventoryRecords = null;
        
        // 清理DOM引用
        this.modal = null;
        this.form = null;
        this.modalTitle = null;
        this.recordTypeInput = null;
        this.itemNameInput = null;
        this.itemIdInput = null;
        this.recordLocationInput = null;
        this.quantityInput = null;
        this.reasonInput = null;
        this.dateInput = null;
        this.itemNameList = null;
        this.itemIdList = null;
        this.currentQuantityValue = null;
        this.inventoryTableBody = null;
        
        console.log('库存模块资源已清理');
    }
}
