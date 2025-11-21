/**
 * 容器网格组件
 * 用于以网格形式显示容器卡片，支持无限层级嵌套
 */

export class ContainerGrid {
    // 静态初始化方法，将组件注册到全局
    static registerGlobal() {
        window.ContainerGrid = ContainerGrid;
        console.log('✅ ContainerGrid: 已注册到全局window对象');
    }
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('❌ ContainerGrid: 找不到容器元素:', containerId);
            return;
        }
        
        this.onContainerSelect = null;
        this.currentContainers = []; // 保存当前显示的容器数据
        
        // 使用事件委托，将点击事件绑定到容器元素上
        this.container.addEventListener('click', (e) => {
            const card = e.target.closest('.container-card');
            // 检查点击是否发生在操作按钮区域，如果是则忽略
            if (card && !e.target.closest('.container-actions')) {
                this.handleContainerClick(card, this.currentContainers);
            }
        });
        
        console.log('✅ ContainerGrid 初始化成功');
    }

    /**
     * 设置容器选择回调
     */
    setOnContainerSelect(callback) {
        if (typeof callback === 'function') {
            this.onContainerSelect = callback;
        } else {
            console.error('❌ ContainerGrid: onContainerSelect 回调必须是函数');
        }
    }



    /**
     * 显示容器列表
     */
    showContainers(containers, parentInfo) {
        // 显示包含此容器网格的父section
        if (this.container.parentElement) {
            this.container.parentElement.style.display = 'block';
        }
        if (!this.validateContainersData(containers)) {
            this.showEmpty();
            return;
        }

        try {
            const gridHtml = containers.map(container => 
                this.createContainerCard(container)
            ).join('');

            this.container.innerHTML = gridHtml;
            this.currentContainers = containers; // 保存当前显示的容器数据
            
        } catch (error) {
            console.error('❌ ContainerGrid 渲染失败:', error);
            this.showError('容器显示失败: ' + error.message);
        }
    }

    /**
 * 验证容器数据
 */
validateContainersData(containers) {
    console.log('ContainerGrid: Validating containers data...');
    
    if (!this.container) {
        console.error('❌ ContainerGrid: 容器元素未初始化', { container: this.container });
        return false;
    }

    if (!containers) {
        console.warn('⚠️ ContainerGrid: 容器数据为空', { containers });
        return false;
    }

    if (!Array.isArray(containers)) {
        console.error('❌ ContainerGrid: 容器数据不是数组', { containers, type: typeof containers });
        return false;
    }

    if (containers.length === 0) {
        console.log('🔍 ContainerGrid: 没有容器数据', { containers });
        return false;
    }
    
    // 验证每个容器对象的基本结构
    const validContainers = containers.filter(container => {
        const isValid = container && (container.id || container._id) && container.name;
        if (!isValid) {
            console.log('❌ Invalid container: missing id or name', container);
        }
        return isValid;
    });
    if (validContainers.length !== containers.length) {
        console.warn('⚠️ ContainerGrid: 部分容器数据结构不完整', { 
            totalContainers: containers.length, 
            validContainers: validContainers.length 
        });
    }

    console.log('ContainerGrid: Validation passed', { containerCount: containers.length });
    return true;
}

    /**
     * 创建容器卡片
     */
    createContainerCard(container) {
        const itemCount = this.calculateTotalItems(container);
        const subContainerCount = this.calculateSubContainers(container);
        
        const iconConfig = this.getContainerIconConfig(container);
        const containerName = container.name || '未命名容器';
        const containerType = container.type === 'room' ? '房间' : (container.type || '容器');
        const containerId = container.id || container._id || `container_${Date.now()}`;

        return `
            <div class="container-card" data-container-id="${containerId}" data-container-name="${containerName}">
                <div class="container-header">
                    <div class="container-icon ${iconConfig.class}">
                        ${iconConfig.icon}
                    </div>
                    <div class="container-info">
                        <div class="container-name" title="${containerName}">${containerName}</div>
                        <div class="container-type">${containerType}</div>
                    </div>
                </div>
                
                <div class="container-meta">
                    <div class="meta-item">
                        <span class="meta-value">${itemCount}</span>
                        <span class="meta-label">物品</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-value">${subContainerCount}</span>
                        <span class="meta-label">子容器</span>
                    </div>
                </div>

                <div class="container-actions">
                    <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); app.deleteContainer('${containerId}', '${containerName}', ${this.calculateTotalSubContainers(container)})" title="删除容器">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 绑定容器事件 (不再需要，事件委托已实现)
     */
    bindContainerEvents(containers) {
        // 已使用事件委托替代直接绑定
        console.log('⚠️ ContainerGrid.bindContainerEvents is deprecated. 使用事件委托替代');
    }

    /**
     * 处理容器点击
     */
    handleContainerClick(card, containers) {
        const containerId = card.dataset.containerId;
        const container = containers.find(c => c.id === containerId || c._id === containerId);
        
        if (container && this.onContainerSelect) {
            this.onContainerSelect(container);
        } else {
            console.warn('⚠️ ContainerGrid: 容器选择回调未设置或容器未找到');
        }
    }

    /**
     * 选择容器（高亮显示）
     */
    selectContainer(containerId) {
        this.clearActiveStates();
        
        const selectedCard = this.container.querySelector(`[data-container-id="${containerId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('active');
        }
    }

    /**
     * 清除所有活跃状态
     */
    clearActiveStates() {
        const activeCards = this.container.querySelectorAll('.container-card.active');
        activeCards.forEach(card => {
            card.classList.remove('active');
        });
    }

    /**
     * 容器数据处理方法
     */

    /**
     * 获取容器图标配置
     */
    getContainerIconConfig(container) {
        const type = (container.type || '').toLowerCase();
        
        // 基于sampleData.js中的容器类型生成的图标配置
        const iconConfigs = {
            // 房间类型
            'room': { class: 'container-room', icon: '<i class="fas fa-home"></i>' },
            
            // 具体容器类型 - 完全匹配（使用Font Awesome 6.0.0中存在的图标）
            'shoe_rack': { class: 'container-shoe-rack', icon: '<i class="fas fa-shoe-prints"></i>' },
            'cabinet': { class: 'container-cabinet', icon: '<i class="fas fa-archive"></i>' },
            'shelf': { class: 'container-shelf', icon: '<i class="fas fa-layer-group"></i>' },
            'drawer': { class: 'container-drawer', icon: '<i class="fas fa-drawer"></i>' },
            'basket': { class: 'container-basket', icon: '<i class="fas fa-shopping-basket"></i>' },
            'fridge': { class: 'container-fridge', icon: '<i class="fa-solid fa-igloo"></i>' },
            'overhead_cabinet': { class: 'container-overhead-cabinet', icon: '<i class="fas fa-cubes"></i>' },
            'sideboard': { class: 'container-sideboard', icon: '<i class="fas fa-couch"></i>' },
            'wine_cabinet': { class: 'container-wine-cabinet', icon: '<i class="fas fa-wine-bottle"></i>' },
            'wardrobe': { class: 'container-wardrobe', icon: '<i class="fas fa-tshirt"></i>' },
            'storage_box': { class: 'container-storage-box', icon: '<i class="fas fa-box"></i>' },
            'vanity': { class: 'container-vanity', icon: '<i class="fas fa-toilet"></i>' },
            'nightstand': { class: 'container-nightstand', icon: '<i class="fas fa-bed"></i>' },
            'dresser': { class: 'container-dresser', icon: '<i class="fas fa-gem"></i>' },
            'ottoman': { class: 'container-ottoman', icon: '<i class="fas fa-couch"></i>' },
            'filing_cabinet': { class: 'container-filing-cabinet', icon: '<i class="fas fa-file"></i>' },
            'bathroom_cabinet': { class: 'container-bathroom-cabinet', icon: '<i class="fas fa-shower"></i>' },
            'mirror_cabinet': { class: 'container-mirror-cabinet', icon: '<i class="fas fa-image"></i>' },
            'shelf_layer': { class: 'container-shelf-layer', icon: '<i class="fas fa-layer-group"></i>' },
            'mirror_section': { class: 'container-mirror-section', icon: '<i class="fas fa-window"></i>' },
            'small_cabinet': { class: 'container-small-cabinet', icon: '<i class="fas fa-cube"></i>' },
            'cabinet_door': { class: 'container-cabinet-door', icon: '<i class="fas fa-door-open"></i>' },
            
            // 通用匹配 - 基于名称包含关系
            '柜': { class: 'container-cabinet-generic', icon: '<i class="fas fa-archive"></i>' },
            '架': { class: 'container-shelf-generic', icon: '<i class="fas fa-layer-group"></i>' },
            '抽屉': { class: 'container-drawer-generic', icon: '<i class="fas fa-drawer"></i>' },
            '盒': { class: 'container-box-generic', icon: '<i class="fas fa-box"></i>' }
        };

        // 首先尝试完全匹配具体类型
        if (iconConfigs[type]) {
            return iconConfigs[type];
        }

        // 然后尝试基于名称包含关系的通用匹配
        for (const [key, config] of Object.entries(iconConfigs)) {
            if (type.includes(key)) {
                return config;
            }
        }

        // 默认配置
        return { class: 'container-default', icon: '<i class="fas fa-archive"></i>' };
    }

    /**
     * 计算容器下的总物品数量
     */
    calculateTotalItems(container) {
        let count = 0;
        
        // 当前容器的直接物品
        if (container.items) {
            count += container.items.length;
        }
        
        // 处理子容器 - 使用containers字段（新的数据结构）
        const allContainers = container.containers || [];
        allContainers.forEach(child => {
            count += this.calculateTotalItems(child);
        });
        
        return count;
    }

    /**
     * 计算子容器数量
     */
    calculateSubContainers(container) {
        if (!container) return 0;
        
        // 使用containers字段（新的数据结构）
        const allContainers = container.containers || [];
        
        // 只返回直接子容器数量，不包括嵌套子容器
        return allContainers.length;
    }

    /**
     * 计算容器及其所有嵌套子容器的总数
     */
    calculateTotalSubContainers(container) {
        if (!container || !container.containers) return 0;
        
        let total = container.containers.length;
        
        // 递归计算所有嵌套子容器
        container.containers.forEach(subContainer => {
            total += this.calculateTotalSubContainers(subContainer);
        });
        
        return total;
    }

    // 不再需要本地的findContainerById方法，已使用utils.js中的findNodeById

    /**
     * UI状态方法
     */

    /**
     * 显示加载状态
     */
    showLoading() {
        if (this.container) {
            this.container.innerHTML = '<div class="loading">容器加载中...</div>';
        }
    }

    /**
     * 显示空状态
     */
    showEmpty() {
        if (this.container) {
            this.container.innerHTML = `
                <div class="containers-empty">
                    <i class="fas fa-folder-open fa-3x"></i>
                    <p>暂无容器数据</p>
                </div>
            `;
        }
    }

    /**
     * 显示错误状态
     */
    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>容器加载失败</p>
                    <small>${message}</small>
                </div>
            `;
        }
    }

    /**
     * 刷新容器网格
     */
    refresh(containers, parentInfo) {
        this.showContainers(containers, parentInfo);
    }

    /**
     * 清空容器网格
     */
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }

    /**
     * 获取容器统计信息
     */
    getContainerStats(containers) {
        if (!containers || !Array.isArray(containers)) {
            return { totalContainers: 0, totalItems: 0, totalSubContainers: 0 };
        }

        let totalContainers = containers.length;
        let totalItems = 0;
        let totalSubContainers = 0;

        containers.forEach(container => {
            totalItems += this.calculateTotalItems(container);
            totalSubContainers += this.calculateSubContainers(container);
        });

        return {
            totalContainers,
            totalItems,
            totalSubContainers
        };
    }

    /**
     * 过滤容器
     */
    filterContainers(containers, filterFn) {
        if (!containers || !Array.isArray(containers)) {
            return [];
        }

        return containers.filter(filterFn);
    }

    /**
     * 按类型过滤容器
     */
    filterContainersByType(containers, type) {
        return this.filterContainers(containers, container => {
            const containerType = (container.type || '').toLowerCase();
            const searchType = type.toLowerCase();
            return containerType.includes(searchType);
        });
    }

    /**
     * 按名称搜索容器
     */
    searchContainers(containers, keyword) {
        return this.filterContainers(containers, container => {
            const containerName = (container.name || '').toLowerCase();
            const searchKeyword = keyword.toLowerCase();
            return containerName.includes(searchKeyword);
        });
    }

    /**
     * 排序容器
     */
    sortContainers(containers, sortFn) {
        if (!containers || !Array.isArray(containers)) {
            return [];
        }

        return [...containers].sort(sortFn);
    }

    /**
     * 按名称排序容器
     */
    sortContainersByName(containers, ascending = true) {
        return this.sortContainers(containers, (a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            
            if (ascending) {
                return nameA.localeCompare(nameB);
            } else {
                return nameB.localeCompare(nameA);
            }
        });
    }

    /**
     * 按物品数量排序容器
     */
    sortContainersByItemCount(containers, ascending = true) {
        return this.sortContainers(containers, (a, b) => {
            const countA = this.calculateTotalItems(a);
            const countB = this.calculateTotalItems(b);
            
            if (ascending) {
                return countA - countB;
            } else {
                return countB - countA;
            }
        });
    }
}