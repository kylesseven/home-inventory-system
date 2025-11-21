/**
 * 通用模态框组件
 * 用于显示表单和对话框
 */

class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.init();
    }

    /**
     * 初始化模态框
     */
    init() {
        if (!this.modal) return;

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
     * 显示模态框
     */
    show() {
        if (this.modal) {
            this.modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // 防止背景滚动
        }
    }

    /**
     * 隐藏模态框
     */
    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = ''; // 恢复滚动
        }
    }

    /**
     * 设置模态框内容
     */
    setContent(title, content) {
        if (!this.modal) return;

        const titleElement = this.modal.querySelector('.modal-title');
        const bodyElement = this.modal.querySelector('.modal-body');

        if (titleElement) titleElement.textContent = title;
        if (bodyElement) bodyElement.innerHTML = content;
    }

    /**
     * 设置确认回调
     */
    setOnConfirm(callback) {
        this.onConfirm = callback;
    }

    /**
     * 设置取消回调
     */
    setOnCancel(callback) {
        this.onCancel = callback;
    }
}