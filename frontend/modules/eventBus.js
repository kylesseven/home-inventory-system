// 全局事件总线模块
let eventBus = null;

class EventBus {
    constructor() {
        this.events = {};
    }

    /**
     * 订阅事件
     * @param {string} eventName - 事件名称
     * @param {function} callback - 回调函数
     * @returns {function} - 取消订阅函数
     */
    subscribe(eventName, callback) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }

        const index = this.events[eventName].push(callback) - 1;

        return () => {
            delete this.events[eventName][index];
        };
    }

    /**
     * 发布事件
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     */
    publish(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => {
                if (typeof callback === 'function') {
                    callback(data);
                }
            });
        }
    }

    /**
     * 发布事件并返回Promise
     * @param {string} eventName - 事件名称
     * @param {*} data - 事件数据
     * @returns {Promise<Array>} - 所有回调函数的返回值数组
     */
    publishAsync(eventName, data) {
        if (this.events[eventName]) {
            return Promise.all(this.events[eventName].map(callback => {
                if (typeof callback === 'function') {
                    return callback(data);
                }
            }));
        }
        return Promise.resolve([]);
    }

    /**
     * 移除事件的所有订阅者
     * @param {string} eventName - 事件名称
     */
    removeEvent(eventName) {
        delete this.events[eventName];
    }

    /**
     * 获取事件总线的单例实例
     * @returns {EventBus} - 事件总线实例
     */
    static getInstance() {
        if (!eventBus) {
            eventBus = new EventBus();
        }
        return eventBus;
    }
}

export default EventBus.getInstance();