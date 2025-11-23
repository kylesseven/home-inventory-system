/**
 * 通用确认模态框组件
 * 用于处理各种需要用户确认的操作，如删除确认
 */
class ConfirmModal {
    /**
     * 构造函数
     * @param {string} modalId - 模态框元素的ID
     * @param {string} confirmBtnId - 确认按钮的ID
     * @param {string} cancelBtnId - 取消按钮的ID
     */
    constructor(modalId, confirmBtnId, cancelBtnId) {
        this.modal = document.getElementById(modalId);
        this.confirmButton = document.getElementById(confirmBtnId);
        this.cancelButton = document.getElementById(cancelBtnId);
        
        this.confirmCallback = null;
        this.cancelCallback = null;
        this.contextData = null;
        
        this._bindEvents();
    }
    
    /**
     * 绑定事件监听器
     * @private
     */
    _bindEvents() {
        if (this.confirmButton) {
            this.confirmButton.addEventListener('click', this._handleConfirm.bind(this));
        }
        
        if (this.cancelButton) {
            this.cancelButton.addEventListener('click', this._handleCancel.bind(this));
        }
        
        if (this.modal) {
            this.modal.addEventListener('click', this._handleModalClick.bind(this));
        }
    }
    
    /**
     * 处理确认按钮点击
     * @private
     */
    _handleConfirm() {
        if (typeof this.confirmCallback === 'function') {
            this.confirmCallback(this.contextData);
        }
        this.hide();
    }
    
    /**
     * 处理取消按钮点击
     * @private
     */
    _handleCancel() {
        if (typeof this.cancelCallback === 'function') {
            this.cancelCallback(this.contextData);
        }
        this.hide();
    }
    
    /**
     * 处理模态框背景点击
     * @param {MouseEvent} event - 点击事件
     * @private
     */
    _handleModalClick(event) {
        // 点击模态框背景关闭模态框
        if (event.target === this.modal) {
            this.hide();
        }
    }
    
    /**
     * 显示模态框
     * @param {Object} options - 配置选项
     * @param {string} options.title - 模态框标题
     * @param {string} options.message - 模态框消息
     * @param {function} options.onConfirm - 确认回调函数
     * @param {function} options.onCancel - 取消回调函数
     * @param {*} options.context - 传递给回调函数的上下文数据
     */
    show(options = {}) {
        // 设置回调函数和上下文数据
        this.confirmCallback = options.onConfirm || null;
        this.cancelCallback = options.onCancel || null;
        this.contextData = options.context || null;
        
        // 更新模态框内容（如果提供了标题和消息元素）
        if (options.title) {
            const titleElement = this.modal.querySelector('.modal-title');
            if (titleElement) titleElement.textContent = options.title;
        }
        
        if (options.message) {
            const messageElement = this.modal.querySelector('.modal-message');
            if (messageElement) messageElement.textContent = options.message;
        }
        
        // 显示模态框
        if (this.modal) {
            this.modal.style.display = 'block';
            // 可选：添加动画类
            setTimeout(() => {
                this.modal.classList.add('show');
            }, 10);
        }
    }
    
    /**
     * 隐藏模态框
     */
    hide() {
        if (this.modal) {
            // 可选：添加动画类
            this.modal.classList.remove('show');
            
            // 延迟后完全隐藏，以便动画完成
            setTimeout(() => {
                this.modal.style.display = 'none';
            }, 300);
        }
    }
    
    /**
     * 销毁模态框组件
     */
    destroy() {
        // 移除事件监听器
        if (this.confirmButton) {
            this.confirmButton.removeEventListener('click', this._handleConfirm);
        }
        
        if (this.cancelButton) {
            this.cancelButton.removeEventListener('click', this._handleCancel);
        }
        
        if (this.modal) {
            this.modal.removeEventListener('click', this._handleModalClick);
        }
        
        // 清理引用
        this.modal = null;
        this.confirmButton = null;
        this.cancelButton = null;
        this.confirmCallback = null;
        this.cancelCallback = null;
        this.contextData = null;
    }
}

// 导出组件
export default ConfirmModal;