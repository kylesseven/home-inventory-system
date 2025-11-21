/**
 * 容器表单组件
 * 用于添加和编辑容器
 */

import StateModule from '../modules/state.js';
import eventBus from '../modules/eventBus.js';
import { isContainerNode } from '../modules/utils.js';

export default class ContainerForm {
    constructor(modalId, apiBase) {
        this.modal = document.getElementById(modalId);
        this.onSubmit = null;
        this.currentParentContainerId = null;
        this.parentContainerName = '';
        this.editingContainer = null;
        this.apiBase = apiBase;

        this.init();
    }

    /**
     * 初始化表单
     */
    init() {
        if (!this.modal) {
            console.error('❌ ContainerForm: 找不到模态框元素');
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
     * 显示添加子容器表单
     */
    showAddForm(parentContainerId, parentContainerName) {
        // 详细调试信息
        console.group('🔍 ContainerForm.showAddForm Debug');
        console.log('parentContainerId:', parentContainerId);
        console.log('parentContainerName:', parentContainerName);
        console.log('this.modal:', this.modal);
        console.log('this.currentParentContainerId:', this.currentParentContainerId);
        console.log('this.editingContainer:', this.editingContainer);

        this.currentParentContainerId = parentContainerId;
        this.editingContainer = null;

        const title = `添加子容器到 ${parentContainerName}`;
        const formHtml = this.getFormHtml(null, parentContainerName);
        
        console.log('Generated form HTML:', formHtml);
        this.setContent(title, formHtml);
        this.bindFormEvents();
        this.show();
        console.groupEnd();
    }

    /**
     * 显示编辑容器表单
     */
    showEditForm(container, parentContainerName) {
        this.editingContainer = container;
        this.currentParentContainerId = null;

        const title = `编辑容器 - ${container.name}`;
        const formHtml = this.getFormHtml(container, parentContainerName);
        
        this.setContent(title, formHtml);
        this.bindFormEvents();
        this.show();
    }

    /**
     * 获取表单HTML
     */
    getFormHtml(container = null, parentContainerName = '') {
        const isEditing = !!container;
        
        return `
            <form id="containerForm" class="modal-form">
                <div class="form-group">
                    <label for="containerName">容器名称 *</label>
                    <input type="text" id="containerName" value="${container ? this.escapeHtml(container.name) : ''}" required>
                </div>

                <div class="form-group">
                    <label for="containerType">容器类型</label>
                    <select id="containerType">
                        <option value="" ${!container || container.type === '' ? 'selected' : ''}>选择类型</option>
                        <option value="橱柜" ${container && container.type === '橱柜' ? 'selected' : ''}>橱柜</option>
                        <option value="抽屉" ${container && container.type === '抽屉' ? 'selected' : ''}>抽屉</option>
                        <option value="盒子" ${container && container.type === '盒子' ? 'selected' : ''}>盒子</option>
                        <option value="瓶子" ${container && container.type === '瓶子' ? 'selected' : ''}>瓶子</option>
                        <option value="袋子" ${container && container.type === '袋子' ? 'selected' : ''}>袋子</option>
                        <option value="其他" ${container && container.type === '其他' ? 'selected' : ''}>其他</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="containerDescription">备注</label>
                    <textarea id="containerDescription" rows="3" placeholder="容器描述或其他信息">${container ? this.escapeHtml(container.description || '') : ''}</textarea>
                </div>

                ${parentContainerName ? `<div class="form-info">将添加到: <strong>${this.escapeHtml(parentContainerName)}</strong></div>` : ''}

                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" id="cancelContainerForm">取消</button>
                    <button type="submit" class="btn btn-primary">${isEditing ? '更新' : '添加'}容器</button>
                </div>
            </form>
        `;
    }

    /**
     * 绑定表单事件
     */
    bindFormEvents() {
        const form = document.getElementById('containerForm');
        if (form) {
            // 移除现有的事件监听器
            form.removeEventListener('submit', this.handleSubmit.bind(this));
            form.addEventListener('submit', this.handleSubmit.bind(this));
        }

        const cancelBtn = document.getElementById('cancelContainerForm');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hide());
        }
    }

    /**
     * 处理表单提交
     */
    async handleSubmit(e) {
        e.preventDefault();

        try {
            const formData = this.getFormData();
            const containerData = this.validateForm(formData);

            if (this.editingContainer) {
                await this.updateContainer(this.editingContainer.id, containerData);
            } else {
                await this.addContainer(containerData);
            }

            if (this.onSubmit) {
                this.onSubmit();
            }

            this.hide();
        } catch (error) {
            console.error('❌ ContainerForm 提交失败:', error);
            this.showMessage(error.message || '容器操作失败', 'error');
        }
    }

    /**
     * 获取表单数据
     */
    getFormData() {
        const containerName = document.getElementById('containerName').value.trim();
        const containerType = document.getElementById('containerType').value;
        const containerDescription = document.getElementById('containerDescription').value.trim();

        return {
            containerName,
            containerType,
            containerDescription
        };
    }

    /**
     * 验证表单数据
     */
    validateForm(data) {
        if (!data.containerName) {
            throw new Error('容器名称不能为空');
        }

        return {
            name: data.containerName,
            type: data.containerType,
            description: data.containerDescription
        };
    }

    /**
     * 添加容器
     */
    async addContainer(containerData) {
        try {
            // 优先获取当前选中的节点，如果没有则获取当前选中的存储容器
            let currentNode = StateModule.getSelectedNode();
            if (!currentNode) {
                currentNode = StateModule.getSelectedStorageContainer();
            }
            
            // 检查是否找到了节点信息
            if (!currentNode) {
                throw new Error('当前选中节点信息未找到');
            }
            
            // 获取当前区域信息（房间）
            let currentArea;
            let parentContainerId;
            
            if (currentNode.type === 'room') {
                // 如果当前节点是房间，直接使用
                currentArea = currentNode;
                parentContainerId = this.currentParentContainerId; // 应该为null
            } else if (isContainerNode(currentNode)) {
                // 如果当前节点是容器，向上查找房间
                const rooms = StateModule.getCache('rooms');
                currentArea = this.findParentRoom(rooms, currentNode.id);
                // 使用当前选中的容器ID作为父容器ID，或者使用this.currentParentContainerId
                parentContainerId = this.currentParentContainerId || (currentNode.id || currentNode._id);
            }
            
            // 检查是否找到了区域信息
            if (!currentArea) {
                throw new Error('当前区域信息未找到');
            }

            const response = await fetch(`${this.apiBase}/storage_units`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    areaId: currentArea._id || currentArea.id,
                    parentStorageUnitId: parentContainerId,
                    storageUnitData: containerData
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.message || '添加容器失败');
            }

            const result = await response.json();
            this.showMessage('容器添加成功', 'success');
            // 发布数据更新事件，通知其他模块刷新数据
            eventBus.publish('data-updated', { containers: result });
            return result;
        } catch (error) {
            // 忽略net::ERR_ABORTED错误，这通常是由于页面导航或请求中断导致，不影响实际功能
            if (!error.message.includes('net::ERR_ABORTED')) {
                console.error('❌ ContainerForm 添加容器失败:', error);
                throw error;
            } else {
                console.warn('⚠️ ContainerForm 添加容器请求被中断，这通常是正常的页面导航行为');
            }
        }
    }

    /**
     * 更新容器
     */
    async updateContainer(containerId, containerData) {
        try {
            // 优先获取当前选中的节点，如果没有则获取当前选中的存储容器
            let currentNode = StateModule.getSelectedNode();
            if (!currentNode) {
                currentNode = StateModule.getSelectedStorageContainer();
            }
            
            // 检查是否找到了节点信息
            if (!currentNode) {
                throw new Error('当前选中节点信息未找到');
            }
            
            // 获取当前区域信息（房间）
            let currentArea;
            if (currentNode.type === 'room') {
                // 如果当前节点是房间，直接使用
                currentArea = currentNode;
            } else if (currentNode.type === 'container' || currentNode.type === 'subContainer') {
                // 如果当前节点是容器，向上查找房间
                const rooms = StateModule.getCache('rooms');
                currentArea = this.findParentRoom(rooms, currentNode.id);
            }
            
            // 检查是否找到了区域信息
            if (!currentArea) {
                throw new Error('当前区域信息未找到');
            }

            const response = await fetch(`${this.apiBase}/storage_units/${containerId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    areaId: currentArea._id || currentArea.id,
                    storageUnitData: containerData
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.message || '更新容器失败');
            }

            const result = await response.json();
            this.showMessage('容器更新成功', 'success');
            // 发布数据更新事件，通知其他模块刷新数据
            eventBus.publish('data-updated', { containers: result });
            return result;
        } catch (error) {
            // 忽略net::ERR_ABORTED错误，这通常是由于页面导航或请求中断导致，不影响实际功能
            if (!error.message.includes('net::ERR_ABORTED')) {
                console.error('❌ ContainerForm 更新容器失败:', error);
                throw error;
            } else {
                console.warn('⚠️ ContainerForm 更新容器请求被中断，这通常是正常的页面导航行为');
            }
        }
    }

    /**
     * 设置模态框内容
     */
    setContent(title, content) {
        const modalHeader = this.modal.querySelector('.modal-header');
        const modalBody = this.modal.querySelector('.modal-body');

        if (modalHeader) {
            modalHeader.innerHTML = `
                <div class="modal-title">${title}</div>
                <button class="modal-close" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            `;
        }

        if (modalBody) {
            modalBody.innerHTML = content;
        }

        // 重新绑定关闭按钮
        const closeBtn = this.modal.querySelector('.modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
    }

    /**
     * 显示模态框
     */
    show() {
        // 详细调试信息
        console.group('🔍 ContainerForm.show Debug');
        console.log('this.modal:', this.modal);
        if (this.modal) {
            console.log('Modal display before:', this.modal.style.display);
            this.modal.style.display = 'flex';
            console.log('Modal display after:', this.modal.style.display);
            document.body.style.overflow = 'hidden';
        } else {
            console.error('Modal element is null!');
        }
        console.groupEnd();
    }

    /**
     * 隐藏模态框
     */
    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }
    
    /**
     * 清空表单数据
     */
    clearForm() {
        this.editingContainer = null;
        this.currentParentContainerId = null;
    }
    
    /**
     * 设置父容器ID
     */
    setParentContainerId(id) {
        this.currentParentContainerId = id;
    }
    
    /**
     * 设置父容器名称
     */
    setParentContainerName(name) {
        this.parentContainerName = name;
    }
    
    /**
     * 打开容器表单
     */
    open() {
        // 根据当前状态决定显示添加还是编辑表单
        const isEditing = this.editingContainer !== null;
        const title = isEditing ? `编辑容器 - ${this.editingContainer.name}` : `添加容器到 ${this.parentContainerName}`;
        const formHtml = this.getFormHtml(this.editingContainer, this.parentContainerName);
        
        this.setContent(title, formHtml);
        this.bindFormEvents();
        this.show();
    }

    /**
     * 设置提交回调
     */
    setOnSubmit(callback) {
        if (typeof callback === 'function') {
            this.onSubmit = callback;
        } else {
            console.error('❌ ContainerForm: onSubmit 回调必须是函数');
        }
    }

    /**
     * 显示消息
     */
    showMessage(message, type = 'success') {
        const existingMessage = this.modal.querySelector('.form-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageHtml = `
            <div class="form-message ${type}">
                ${message}
            </div>
        `;

        const modalBody = this.modal.querySelector('.modal-body');
        if (modalBody) {
            modalBody.insertAdjacentHTML('afterbegin', messageHtml);
        }

        // 3秒后自动移除消息
        setTimeout(() => {
            const messageElement = this.modal.querySelector('.form-message');
            if (messageElement) {
                messageElement.remove();
            }
        }, 3000);
    }

    /**
     * 递归查找容器所在的房间
     */
    findParentRoom(rooms, containerId) {
        for (const room of rooms) {
            // 检查当前房间
            if (room.id === containerId || room._id === containerId) {
                return room;
            }
            
            // 递归搜索房间内的所有容器
            const foundInRoom = this.searchContainerInRoom(room, containerId);
            if (foundInRoom) {
                return room;
            }
        }
        
        return null;
    }
    
    // 辅助方法：递归搜索房间内的容器
    searchContainerInRoom(room, containerId) {
        if (!room.containers || !Array.isArray(room.containers)) {
            return false;
        }
        
        for (const container of room.containers) {
            if (container.id === containerId || container._id === containerId) {
                return true;
            }
            
            // 递归检查子容器
            if (container.containers && Array.isArray(container.containers)) {
                // 创建一个临时对象，只包含当前容器的子容器，用于递归搜索
                const tempRoom = { containers: container.containers };
                if (this.searchContainerInRoom(tempRoom, containerId)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * HTML转义处理
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}