/**
 * 物品表单组件
 * 用于添加和编辑物品
 */

import StateModule from '../modules/state.js';
import { findNodeById } from '../modules/utils.js';

export class ItemForm {
    constructor(modalId, apiBase) {
        this.modal = document.getElementById(modalId);
        this.onSubmit = null;
        this.currentContainerId = null;
        this.editingItem = null;
        this.apiBase = apiBase;

        this.init();
    }

    /**
     * 初始化表单
     */
    init() {
        if (!this.modal) {
            console.error('❌ ItemForm: 找不到模态框元素');
            return;
        }

        // 点击背景关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // 关闭按钮
        const closeBtn = this.modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
    }

    /**
     * 显示添加物品表单
     */
    async showAddForm(containerId, containerName) {
        this.currentContainerId = containerId;
        this.editingItem = null;

        // 确保物品数据已加载到缓存
        let allItems = StateModule.getCache('items');
        if (allItems.length === 0) {
            try {
                // 从API获取所有物品数据
                const response = await fetch(`${this.apiBase}/items`);
                const result = await response.json();
                if (result.success && result.data) {
                    allItems = result.data;
                    StateModule.setCache('items', allItems);
                }
            } catch (error) {
                console.error('❌ 获取物品数据失败:', error);
            }
        }

        // 获取所有容器数据
        let allContainers = [];
        try {
            const response = await fetch(`${this.apiBase}/storage_units`);
            const result = await response.json();
            if (result.success && result.data) {
                allContainers = result.data;
            }
        } catch (error) {
            console.error('❌ 获取容器数据失败:', error);
        }

        // 缓存所有容器数据和容器名称列表
        this.allContainers = allContainers;
        this.containers = [...new Set(allContainers.map(container => container.name).filter(Boolean))].sort();

        const title = `添加物品到 ${containerName}`;
        const formHtml = this.getFormHtml(null, containerName);
        
        this.setContent(title, formHtml);
        this.bindFormEvents();
        this.show();
    }

    /**
     * 显示编辑物品表单
     */
    async showEditForm(item, containerName) {
        this.editingItem = item;
        this.currentContainerId = null;

        // 确保物品数据已加载到缓存
        let allItems = StateModule.getCache('items');
        if (allItems.length === 0) {
            try {
                // 从API获取所有物品数据
                const response = await fetch(`${this.apiBase}/items`);
                const result = await response.json();
                if (result.success && result.data) {
                    allItems = result.data;
                    StateModule.setCache('items', allItems);
                }
            } catch (error) {
                console.error('❌ 获取物品数据失败:', error);
            }
        }

        // 获取所有容器数据
        let allContainers = [];
        try {
            const response = await fetch(`${this.apiBase}/storage_units`);
            const result = await response.json();
            if (result.success && result.data) {
                allContainers = result.data;
            }
        } catch (error) {
            console.error('❌ 获取容器数据失败:', error);
        }

        // 获取所有区域数据
        let allAreas = [];
        try {
            const response = await fetch(`${this.apiBase}/areas`);
            const result = await response.json();
            if (result.success && result.data) {
                allAreas = result.data;
            }
        } catch (error) {
            console.error('❌ 获取区域数据失败:', error);
        }

        // 构建区域和容器的映射
        const areaMap = new Map(allAreas.map(area => [area._id, area]));
        const containerMap = new Map(allContainers.map(container => [container._id, container]));

        // 构建容器的完整路径
        const containerPaths = allContainers.map(container => ({
            id: container._id,
            path: this.buildContainerPath(container._id, areaMap, containerMap),
            name: container.name
        }));

        // 添加区域到容器列表
        const allContainerOptions = [
            ...allAreas.map(area => ({ id: area._id, path: area.name, name: area.name })),
            ...containerPaths
        ];

        // 按路径排序
        allContainerOptions.sort((a, b) => a.path.localeCompare(b.path));

        // 缓存区域、容器和路径信息
        this.allAreas = allAreas;
        this.allContainers = allContainers;
        this.containerMap = containerMap;
        this.containerPaths = allContainerOptions;

        // 供datalist使用的容器选项
        this.containers = allContainerOptions;

        const title = `编辑物品 - ${item.name}`;
        const formHtml = this.getFormHtml(item, containerName);
        
        this.setContent(title, formHtml);
        this.bindFormEvents();
        this.show();
    }

    /**
     * 获取表单HTML
     */
    getFormHtml(item = null, containerName = '') {
        const isEditing = !!item;
        
        // 获取所有物品数据以提取现有分类和子分类
        const allItems = StateModule.getCache('items');
        
        // 提取所有唯一分类
        const categories = [...new Set(allItems.map(item => item.category).filter(Boolean))].sort();
        
        // 提取所有唯一子分类
        const subcategories = [...new Set(allItems.map(item => item.subcategory).filter(Boolean))].sort();
        
        // 使用已缓存的容器列表
        const containers = this.containers || [];
        
        // 格式化日期以符合输入框要求
        const formattedExpiryDate = item ? this.formatDateForInput(item.expiryDate) : '';
        
        return `
            <form id="itemForm" class="modal-form">
                <!-- 第一行：物品名称和所属容器 -->
                <div class="form-row">
                    <div class="form-group">
                        <label for="itemName">物品名称 *</label>
                        <input type="text" id="itemName" value="${item ? this.escapeHtml(item.name) : ''}" required placeholder="请输入物品名称">
                    </div>
                    <div class="form-group">
                        <label for="itemContainer">所属容器 *</label>
                        <input type="text" id="itemContainer" list="containerOptions" value="${item ? this.escapeHtml(this.getItemContainerName(item)) : (containerName ? this.escapeHtml(containerName) : '')}" required placeholder="选择或输入所属容器">
                        <datalist id="containerOptions">
                            <option value="">请选择容器</option>
                            ${containers.map(container => {
                                const containerValue = container.path || container;
                                const containerDisplay = container.path || container;
                                return `<option value="${this.escapeHtml(containerValue)}">${this.escapeHtml(containerDisplay)}</option>`;
                            }).join('')}
                        </datalist>
                    </div>
                </div>

                <!-- 第二行：数量和库存预警阈值 -->
                <div class="form-row">
                    <div class="form-group">
                        <label for="itemQuantity">数量 *</label>
                        <input type="number" id="itemQuantity" value="${item ? item.quantity : '1'}" min="0" step="1" required placeholder="请输入数量" readonly>
                    </div>
                    <div class="form-group">
                        <label for="itemStockAlert">库存预警阈值</label>
                        <input type="number" id="itemStockAlert" value="${item ? (item.stockAlert || '') : ''}" min="0" step="1" placeholder="如: 10">
                    </div>
                </div>

                <!-- 第三行：单位和规格 -->
                <div class="form-row">
                    <div class="form-group">
                        <label for="itemUnit">单位</label>
                        <input type="text" id="itemUnit" value="${item ? this.escapeHtml(item.unit || '') : ''}" placeholder="如: 个、支、瓶、千克等">
                    </div>
                    <div class="form-group">
                        <label for="itemSpec">规格</label>
                        <input type="text" id="itemSpec" value="${item ? this.escapeHtml(item.spec || '') : ''}" placeholder="如: 500ml、1kg、10cm*20cm等">
                    </div>
                </div>

                <!-- 第四行：过期日期和过期预警阈值 -->
                <div class="form-row">
                    <div class="form-group">
                        <label for="itemExpiryDate">过期日期</label>
                        <input type="date" id="itemExpiryDate" value="${formattedExpiryDate}">
                    </div>
                    <div class="form-group">
                        <label for="itemExpiryWarning">过期预警阈值 (天)</label>
                        <input type="number" id="itemExpiryWarning" value="${item ? (item.expiryWarning || '') : ''}" min="0" step="1" placeholder="如: 30">
                    </div>
                </div>

                <!-- 第五行：分类和子分类 -->
                <div class="form-row">
                    <div class="form-group">
                        <label for="itemCategory">分类</label>
                        <input type="text" id="itemCategory" list="categoryOptions" value="${item ? this.escapeHtml(item.category || '') : ''}" placeholder="选择或输入分类">
                        <datalist id="categoryOptions">
                            <option value="">请选择分类</option>
                            ${categories.map(category => `<option value="${this.escapeHtml(category)}">${this.escapeHtml(category)}</option>`).join('')}
                        </datalist>
                    </div>
                    <div class="form-group">
                        <label for="itemSubcategory">子分类</label>
                        <input type="text" id="itemSubcategory" list="subcategoryOptions" value="${item ? this.escapeHtml(item.subcategory || '') : ''}" placeholder="选择或输入子分类">
                        <datalist id="subcategoryOptions">
                            <option value="">请选择子分类</option>
                            ${subcategories.map(subcategory => `<option value="${this.escapeHtml(subcategory)}">${this.escapeHtml(subcategory)}</option>`).join('')}
                        </datalist>
                    </div>
                </div>

                <!-- 第六行：描述 -->
                <div class="form-group">
                    <label for="itemDescription">描述</label>
                    <textarea id="itemDescription" rows="2" placeholder="物品描述">${item ? this.escapeHtml(item.description || '') : ''}</textarea>
                </div>

                ${containerName ? `<div class="form-info">将${isEditing ? '更新到' : '添加到'}: <strong>${this.escapeHtml(containerName)}</strong></div>` : ''}

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="cancelItemForm">取消</button>
                    <button type="submit" class="btn btn-primary">${isEditing ? '更新' : '添加'}物品</button>
                </div>
            </form>
        `;
    }

    /**
     * 绑定表单事件
     */
    bindFormEvents() {
        const form = document.getElementById('itemForm');
        if (form) {
            // 移除现有的事件监听器
            form.replaceWith(form.cloneNode(true));
            
            // 重新获取表单元素
            const newForm = document.getElementById('itemForm');
            newForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }

        const cancelBtn = document.getElementById('cancelItemForm');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hide();
            });
        }
    }

    /**
     * 处理表单提交
     */
    async handleSubmit() {
        const formData = this.getFormData();
        
        if (!this.validateForm(formData)) {
            return;
        }

        try {
            let result;
            if (this.editingItem) {
                // 更新物品 - 使用正确的_id字段
                result = await this.updateItem(this.editingItem._id || this.editingItem.id, formData);
            } else {
                // 添加物品
                result = await this.addItem(formData);
            }

            this.hide();
            
            if (this.onSubmit) {
                this.onSubmit(result);
            }

            this.showMessage(this.editingItem ? '物品更新成功' : '物品添加成功', 'success');
        } catch (error) {
            console.error('❌ 物品操作失败:', error);
            this.showMessage('操作失败: ' + error.message, 'error');
        }
    }

    /**
     * 构建容器的完整路径
     */
    buildContainerPath(containerId, areaMap, containerMap) {
        const container = containerMap.get(containerId);
        if (!container) return '';
        
        const parentId = container.parentId;
        if (!parentId) return container.name;
        
        // 检查父ID是区域还是容器
        if (parentId.startsWith('area_')) {
            const area = areaMap.get(parentId);
            return area ? `${area.name}/${container.name}` : container.name;
        } else {
            // 父ID是容器ID，递归构建路径
            const parentPath = this.buildContainerPath(parentId, areaMap, containerMap);
            return parentPath ? `${parentPath}/${container.name}` : container.name;
        }
    }

    /**
     * 根据物品获取所属容器的完整路径
     */
    getItemContainerName(item) {
        if (!item) return '';
        const storageUnitId = item.storageUnitId || item.storageUnit; // 兼容旧字段名
        const containerPath = this.containerPaths.find(path => path.id === storageUnitId);
        return containerPath ? containerPath.path : '';
    }

    /**
     * 根据容器路径查找容器ID
     */
    findContainerIdByPath(containerPath) {
        if (!this.containerPaths) return null;
        const containerOption = this.containerPaths.find(option => option.path === containerPath);
        return containerOption ? containerOption.id : null;
    }

    /**
     * 获取表单数据
     */
    getFormData() {
        const containerPath = document.getElementById('itemContainer').value.trim();
        let storageUnitId = this.findContainerIdByPath(containerPath) || '';

        return {
            name: document.getElementById('itemName').value.trim(),
            quantity: parseInt(document.getElementById('itemQuantity').value),
            unit: document.getElementById('itemUnit').value.trim(),
            spec: document.getElementById('itemSpec').value.trim(),
            storageUnitId: storageUnitId,
            category: document.getElementById('itemCategory').value.trim(),
            subcategory: document.getElementById('itemSubcategory').value.trim(),
            description: document.getElementById('itemDescription').value.trim(),
            expiryDate: document.getElementById('itemExpiryDate').value ? new Date(`${document.getElementById('itemExpiryDate').value}T00:00:00.000Z`).toISOString() : null,
            expiryWarning: document.getElementById('itemExpiryWarning').value ? parseInt(document.getElementById('itemExpiryWarning').value) : null,
            stockAlert: document.getElementById('itemStockAlert').value ? parseInt(document.getElementById('itemStockAlert').value) : null
        };
    }

    /**
     * 验证表单
     */
    validateForm(data) {
        if (!data.name) {
            this.showMessage('请输入物品名称', 'error');
            document.getElementById('itemName').focus();
            return false;
        }

        if (!data.quantity || data.quantity < 1) {
            this.showMessage('请输入有效的数量', 'error');
            document.getElementById('itemQuantity').focus();
            return false;
        }

        return true;
    }

    /**
     * 添加物品
     */
    async addItem(itemData) {
        try {
            console.log('🔧 [前端] 发送添加物品请求:', {
                containerId: this.currentContainerId,
                itemData: itemData,
                url: `${this.apiBase}/storage_units/${this.currentContainerId}/items`
            });

            const response = await fetch(`${this.apiBase}/storage_units/${this.currentContainerId}/items`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            console.log('🔧 [前端] 响应状态:', response.status, response.statusText);
            console.log('🔧 [前端] 响应头:', Object.fromEntries(response.headers.entries()));

            // 获取响应文本
            const responseText = await response.text();
            console.log('🔧 [前端] 响应内容长度:', responseText.length);
            console.log('🔧 [前端] 响应内容原始:', responseText);

            // 检查是否为空响应
            if (!responseText || responseText.trim() === '') {
                throw new Error(`服务器返回了空响应 (状态: ${response.status})`);
            }

            let result;
            try {
                // 尝试解析为 JSON
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('❌ [前端] JSON 解析失败:', parseError);
                console.error('❌ [前端] 响应内容:', responseText);
                throw new Error(`服务器返回了无效的 JSON: ${responseText.substring(0, 200)}`);
            }

            if (!response.ok) {
                throw new Error(result.message || `HTTP错误: ${response.status}`);
            }

            if (!result.success) {
                throw new Error(result.message || '操作失败');
            }

            console.log('✅ [前端] 物品添加成功:', result);
            return result.data;

        } catch (error) {
            // 忽略net::ERR_ABORTED错误，这通常是由于页面导航或请求中断导致，不影响实际功能
            if (!error.message.includes('net::ERR_ABORTED')) {
                console.error('❌ [前端] 添加物品请求失败:', error);
                throw error;
            }
        }
    }

    /**
     * 更新物品
     */
    async updateItem(itemId, itemData) {
        try {
            console.log('🔧 [前端] 发送更新物品请求:', {
                itemId: itemId,
                itemData: itemData
            });

            const response = await fetch(`${this.apiBase}/items/${itemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });

            console.log('🔧 [前端] 响应状态:', response.status, response.statusText);

            // 首先获取响应文本
            const responseText = await response.text();
            console.log('🔧 [前端] 响应内容:', responseText);

            let result;
            try {
                // 尝试解析为 JSON
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('❌ [前端] JSON 解析失败:', parseError);
                throw new Error(`服务器返回了无效的响应: ${responseText.substring(0, 100)}`);
            }

            if (!response.ok) {
                throw new Error(result.message || `HTTP错误: ${response.status}`);
            }

            if (!result.success) {
                throw new Error(result.message || '操作失败');
            }

            return result.data;

        } catch (error) {
            // 忽略net::ERR_ABORTED错误，这通常是由于页面导航或请求中断导致，不影响实际功能
            if (!error.message.includes('net::ERR_ABORTED')) {
                console.error('❌ [前端] 更新物品请求失败:', error);
                throw error;
            }
        }
    }

    /**
     * 设置模态框内容
     */
    setContent(title, content) {
        const titleElement = this.modal.querySelector('.modal-title');
        const bodyElement = this.modal.querySelector('.modal-body');

        if (titleElement) titleElement.textContent = title;
        if (bodyElement) bodyElement.innerHTML = content;
    }

    /**
     * 显示模态框
     */
    show() {
        if (this.modal) {
            this.modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * 隐藏模态框
     */
    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    /**
     * 清空表单数据
     */
    clearForm() {
        this.editingItem = null;
        this.currentContainerId = null;
    }
    
    /**
     * 设置容器ID
     */
    setContainerId(id) {
        this.currentContainerId = id;
    }
    
    /**
     * 打开物品表单
     */
    open() {
        // 根据当前状态决定显示添加还是编辑表单
        const isEditing = this.editingItem !== null;
        
        // 获取容器名称
        let containerName = '';
        if (this.currentContainerId) {
            // 从StateModule获取容器名称
            const selectedNode = StateModule.getSelectedNode() || StateModule.getSelectedStorageContainer();
            if (selectedNode) {
                containerName = selectedNode.name;
            } else {
                // 尝试从缓存中查找容器
                const rooms = StateModule.getCache('rooms');
                const container = findNodeById([...rooms], this.currentContainerId);
                containerName = container ? container.name : '当前容器';
            }
        }
        
        const title = isEditing ? `编辑物品 - ${this.editingItem.name}` : `添加物品到 ${containerName}`;
        const formHtml = this.getFormHtml(this.editingItem, containerName);
        
        this.setContent(title, formHtml);
        this.bindFormEvents();
        this.show();
    }
    
    /**
     * 设置提交回调
     */
    setOnSubmit(callback) {
        this.onSubmit = callback;
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'success') {
        // 简单的消息显示
        if (type === 'success') {
            alert('✅ ' + message);
        } else {
            alert('❌ ' + message);
        }
    }

    /**
     * HTML转义，防止XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 将ISO日期字符串转换为输入框所需的YYYY-MM-DD格式
     */
    formatDateForInput(dateString) {
        if (!dateString) return '';
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }
}