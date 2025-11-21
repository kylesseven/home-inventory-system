export class ItemTable {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentPage = 1;
        this.itemsPerPage = 20;
        this.currentItems = [];
        this.materials = [];
        this.containerInfo = {};
        this.itemStatusConfig = [];

    }

    // 显示物品列表
    showItems(items, containerInfo, itemStatusConfig = []) {
        this.currentItems = items;
        this.containerInfo = containerInfo;
        this.itemStatusConfig = itemStatusConfig;
        this.currentPage = 1;
        this.render();
    }

    // 渲染表格和分页
    render() {
        if (!this.currentItems || this.currentItems.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox fa-3x"></i>
                    <p>该${this.containerInfo.type || '容器'}中没有物品</p>
                </div>
            `;
            return;
        }

        // 计算分页数据
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const paginatedItems = this.currentItems.slice(startIndex, endIndex);
        const totalPages = Math.ceil(this.currentItems.length / this.itemsPerPage);

        const tableHtml = `
            <div class="table-container">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>物品名称</th>
                            <th>数量</th>
                            <th>单位</th>
                            <th>规格</th>
                            <th>状态</th>
                            <th>过期日期</th>
                            <th>所属容器</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedItems.map((item, index) => this.createItemRow(item, startIndex + index + 1, this.itemStatusConfig)).join('')}
                    </tbody>
                </table>
            </div>
            ${totalPages > 1 ? this.createPagination(totalPages) : ''}
        `;

        this.container.innerHTML = tableHtml;
        this.bindPaginationEvents();
    }

    // 创建分页控件
    createPagination(totalPages) {
        return `
            <div class="pagination-container">
                <button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" data-page="prev">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <span class="pagination-info">${this.currentPage}/${totalPages}</span>
                <button class="pagination-btn ${this.currentPage === totalPages ? 'disabled' : ''}" data-page="next">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
    }

    // 绑定分页事件
    bindPaginationEvents() {
        const prevBtn = this.container.querySelector('.pagination-btn[data-page="prev"]');
        const nextBtn = this.container.querySelector('.pagination-btn[data-page="next"]');
        const info = this.container.querySelector('.pagination-info');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.render();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.currentItems.length / this.itemsPerPage);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.render();
                }
            });
        }
    }

    // 创建物品行
    createItemRow(item, serialNumber, itemStatusConfig = []) {
        // 根据物品ID查找对应的状态配置
        const statusConfig = itemStatusConfig.find(config => config._id === item.id || config._id === item._id);
        
        const expiryDate = statusConfig?.expiryDate ? 
            new Date(statusConfig.expiryDate).toLocaleDateString('zh-CN') : 
            '无';
        const expiryWarningDays = statusConfig?.expiryWarning || 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 重置时间部分，只比较日期
        
        const itemExpiryDate = statusConfig?.expiryDate ? new Date(statusConfig.expiryDate) : null;
        itemExpiryDate?.setHours(0, 0, 0, 0); // 重置时间部分，只比较日期
        
        let expiryClass = 'expiry-normal'; // 默认绿色
        
        if (itemExpiryDate) {
            // 计算预警日期：过期日期 - 预警天数
            const warningDate = new Date(itemExpiryDate);
            warningDate.setDate(warningDate.getDate() - expiryWarningDays);
            warningDate.setHours(0, 0, 0, 0); // 重置时间部分，只比较日期

            // 应用用户要求的逻辑
            if (today < warningDate) {
                expiryClass = 'expiry-normal'; // 今天在预警日期之前 → 绿色
            } else if (today >= warningDate && today <= itemExpiryDate) {
                expiryClass = 'expiry-low'; // 今天在预警日期和过期日期之间（包括当天）→ 黄色
            } else {
                expiryClass = 'expiry-expired'; // 今天在过期日期之后 → 红色
            }
        }
        
        const stockAlert = statusConfig?.stockAlert || 0;
        const quantityClass = item.quantity < stockAlert ? 'quantity-low' : 'quantity-normal';
        
        // 物品状态颜色类
        let statusClass = '';
        switch(item.status?.toLowerCase()) {
            case '正常':
                statusClass = 'status-normal';
                break;
            case '临期':
            case '异常':
                statusClass = 'status-low';
                break;
            case '过期':
            case '损坏':
                statusClass = 'status-expired';
                break;
            default:
                statusClass = 'status-unknown';
        }

        return `
            <tr>
                <td class="serial-number">${serialNumber}</td>
                <td>${item.name}</td>
                <td><span class="${quantityClass}">${item.quantity}</span></td>
                <td>${item.unit || '-'}</td>
                <td>${item.specification || '-'}</td>
                <td><span class="${statusClass}">${item.status || '-'}</span></td>
                <td><span class="${expiryClass}">${expiryDate}</span></td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="app.navigateToPathSegment('${item.containerId}')" title="跳转到${item.containerName}">
                        ${item.containerName || '-'}
                    </button>
                </td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-success btn-sm" onclick="app.inboundItem('${item._id}')" title="入库">
                            <i class="fas fa-arrow-down"></i>
                        </button>
                        <button class="btn btn-warning btn-sm" onclick="app.outboundItem('${item._id}')" title="出库">
                            <i class="fas fa-arrow-up"></i>
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="app.editItem('${item._id}')" title="编辑">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    // 显示搜索结果
    showSearchResults(results, itemStatusConfig = []) {
        this.itemStatusConfig = itemStatusConfig;
        if (!results || results.length === 0) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search fa-3x"></i>
                    <p>没有找到匹配的物品</p>
                </div>
            `;
            return;
        }

        const tableHtml = `
            <div class="table-container">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>物品名称</th>
                            <th>数量</th>
                            <th>单位</th>
                            <th>规格</th>
                            <th>子类别</th>
                            <th>状态</th>
                            <th>过期日期</th>
                            <th>所在位置</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${results.map((item, index) => this.createSearchResultRow(item, index + 1)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.container.innerHTML = tableHtml;
    }

    // 创建搜索结果行
    createSearchResultRow(item, serialNumber) {
        // 根据物品ID查找对应的状态配置
        const statusConfig = this.itemStatusConfig.find(config => config._id === item.id || config._id === item._id);
        
        const expiryDate = statusConfig?.expiryDate ? 
            new Date(statusConfig.expiryDate).toLocaleDateString('zh-CN') : 
            '-';
        
        const expiryWarningDays = statusConfig?.expiryWarning || 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 重置时间部分，只比较日期
        
        const itemExpiryDate = statusConfig?.expiryDate ? new Date(statusConfig.expiryDate) : null;
        itemExpiryDate?.setHours(0, 0, 0, 0); // 重置时间部分，只比较日期
        
        let expiryClass = 'expiry-normal'; // 默认绿色
        
        if (itemExpiryDate) {
            // 计算预警日期：过期日期 - 预警天数
            const warningDate = new Date(itemExpiryDate);
            warningDate.setDate(warningDate.getDate() - expiryWarningDays);
            warningDate.setHours(0, 0, 0, 0); // 重置时间部分，只比较日期

            // 应用用户要求的逻辑
            if (today < warningDate) {
                expiryClass = 'expiry-normal'; // 今天在预警日期之前 → 绿色
            } else if (today >= warningDate && today <= itemExpiryDate) {
                expiryClass = 'expiry-low'; // 今天在预警日期和过期日期之间（包括当天）→ 黄色
            } else {
                expiryClass = 'expiry-expired'; // 今天在过期日期之后 → 红色
            }
        }
        
        const stockAlert = statusConfig?.stockAlert || 0;
        const quantityClass = item.quantity < stockAlert ? 'quantity-low' : 'quantity-normal';
        
        // 物品状态颜色类
        let statusClass = '';
        switch(item.status?.toLowerCase()) {
            case '正常':
                statusClass = 'status-normal';
                break;
            case '临期':
            case '异常':
                statusClass = 'status-low';
                break;
            case '过期':
            case '损坏':
                statusClass = 'status-expired';
                break;
            default:
                statusClass = 'status-unknown';
        }
        
        return `
            <tr>
                <td>${serialNumber}</td>
                <td><strong>${item.name}</strong></td>
                <td><span class="${quantityClass}">${item.quantity}</span></td>
                <td>${item.unit || '-'}</td>
                <td>${item.specification || '-'}</td>
                <td>${item.subcategory || '-'}</td>
                <td><span class="${statusClass}">${item.status || '-'}</span></td>
                <td><span class="${expiryClass}">${expiryDate}</span></td>
                <td>
                    <div><strong>实验室:</strong> ${item.lab || '-'}</div>
                    <div><strong>位置:</strong> ${item.containerPath || '-'}</div>
                    ${item.containerId ? `<button class="btn btn-secondary btn-sm" onclick="app.navigateToPathSegment('${item.containerId}')" title="跳转到容器位置">
                        <i class="fas fa-arrow-right"></i> 跳转到该位置
                    </button>` : ''}
                </td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="app.editItem('${item.id}')">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn btn-success btn-sm" onclick="app.addItemToContainer('${item.id}', '${item.containerId || ''}')">
                        <i class="fas fa-plus"></i> 新增
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="app.useItem('${item.id}')">
                        <i class="fas fa-utensils"></i> 使用
                    </button>
                </td>
            </tr>
        `;
    }

    // 显示加载状态
    showLoading() {
        this.container.innerHTML = '<div class="loading">加载中...</div>';
    }

    // 显示空状态
    showEmpty() {
        this.container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox fa-3x"></i>
                <p>暂无物品数据</p>
            </div>
        `;
    }

    // 清空表格
    clear() {
        const tbody = this.container.querySelector('table.items-table tbody');
        if (tbody) {
            tbody.innerHTML = '';
        }
    }

    // 加载物品数据
    loadItems(items) {
        // 简单实现，使用showItems方法
        this.showItems(items, { type: '容器' }, []);
    }
}