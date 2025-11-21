import HomeInventoryApp from './app-core.js';
import StateModule from './state.js';
import eventBus from './eventBus.js';
import { searchItems, loadRooms } from './data.js';
import { findNodeById, collectAllItems, isContainerNode, getDirectSubContainers } from './utils.js';
// 删除未使用的导入

/**
 * UI事件处理模块
 * 处理所有UI交互事件逻辑
 */
const UIHandlersModule = {
    /**
     * 设置所有UI事件监听器
     */
    setupUIEventListeners(app) {
        this.setupSearchEventListeners(app);
        this.setupNodeSelectEventListeners(app);
        this.setupFormEventListeners(app);
        this.setupMenuEventListeners(app);
        this.setupItemEventListeners(app);
        this.setupContainerEventListeners(app);
    },
    
    /**
     * 设置搜索事件监听器
     */
    setupSearchEventListeners(app) {
        // 搜索功能事件处理
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        
        // 物料管理界面搜索功能
        const materialsSearchInput = document.getElementById('materialsSearchInput');
        const materialsSearchBtn = document.getElementById('materialsSearchBtn');
        
        if (searchInput) {
            searchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const keyword = searchInput.value.trim();
                    await app.handleSearch(keyword);
                }
            });
        }
        
        if (searchButton) {
            searchButton.addEventListener('click', async () => {
                const keyword = searchInput?.value.trim() || '';
                await app.handleSearch(keyword);
            });
        }
        
        // 物料搜索事件监听
        if (materialsSearchBtn) {
            materialsSearchBtn.addEventListener('click', async () => {
                const keyword = materialsSearchInput?.value.trim() || '';
                if (app.materialsModule) {
                    await app.materialsModule.searchMaterials(keyword);
                }
            });
        }
        
        if (materialsSearchInput) {
            materialsSearchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const keyword = materialsSearchInput.value.trim();
                    if (app.materialsModule) {
                        await app.materialsModule.searchMaterials(keyword);
                    }
                }
            });
        }
    },
    
    /**
     * 设置节点选择事件监听器
     */
    setupNodeSelectEventListeners(app) {
        // 节点选择事件处理
        // NavigationModule中没有setupEventListeners方法，已移除错误调用
    },
    
    /**
     * 设置表单事件监听器
     */
    setupFormEventListeners(app) {
        // 物品表单和容器表单事件处理已在app-core.js中初始化
    },
    
    /**
     * 设置菜单事件监听器
     */
    setupMenuEventListeners(app) {
        // 仪表盘导航事件
        const dashboardNav = document.getElementById('dashboardNav');
        if (dashboardNav) {
            dashboardNav.addEventListener('click', () => {
                app.showDashboard();
            });
        }
        
        // 物料管理导航事件
        const materialsNav = document.getElementById('materialsNav');
        if (materialsNav) {
            materialsNav.addEventListener('click', () => {
                app.materialsModule.showMaterials();
            });
        }
        
        // 库存管理导航事件
        const inventoryNav = document.getElementById('inventoryNav');
        if (inventoryNav) {
            inventoryNav.addEventListener('click', () => {
                app.inventoryModule.showInventory();
            });
        }
        
        // 存储空间总览导航事件
        const storageOverviewNav = document.getElementById('storageOverviewNav');
        if (storageOverviewNav) {
            storageOverviewNav.addEventListener('click', () => {
                app.showStorageOverview();
            });
        }
    },
    
    /**
     * 设置物品事件监听器
     */
    setupItemEventListeners(app) {
        // 物品相关事件处理
        const addItemToContainerBtn = document.getElementById('addItemToContainerBtn');
        if (addItemToContainerBtn) {
            addItemToContainerBtn.addEventListener('click', () => {
                this.handleAddItemClick(app);
            });
        }
        
        // 添加物品按钮事件
        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) {
            addItemBtn.addEventListener('click', () => {
                this.handleAddItemClick(app);
            });
        }
    },
    
    /**
     * 设置容器事件监听器
     */
    setupContainerEventListeners(app) {
        // 添加容器按钮事件
        const addContainerBtn = document.getElementById('addContainerBtn');
        if (addContainerBtn) {
            addContainerBtn.addEventListener('click', () => {
                this.handleAddContainerClick(app);
            });
        }
    },
    
    /**
     * 处理节点选择
     */
    handleNodeSelect(app, node) {
        StateModule.setSelectedNode(node);
        
        if (node.type === 'room') {
            app.showRoomContainers(node);
        } else if (node.type === 'container' || node.type === 'subContainer') {
            this.showContainerContents(app, node);
        }
        
        app.updateAddItemButton(node);
    },
    
    /**
     * 处理搜索
     */
    async handleSearch(app, keyword) {
        if (!keyword.trim()) {
            app.hideSearchResults();
            app.showContainersSection();
            return;
        }
        
        try {
            app.showLoadingState();
            
            // 使用搜索函数并传递API_BASE
            const items = await searchItems(app.API_BASE, keyword);
            
            if (items.length > 0) {
            // 获取物品状态配置
            const itemStatusConfig = StateModule.getCache('itemStatusConfig') || [];
            app.showSearchResults(items, itemStatusConfig);
            app.hideContainersSection();
        } else {
            app.hideSearchResults();
            app.showMessage('未找到匹配的物品', 'info');
        }
        } catch (error) {
            console.error('搜索失败:', error);
            app.showError('搜索失败: ' + error.message);
        } finally {
            app.hideLoadingState();
        }
    },
    
    /**
     * 刷新当前视图
     */
    async refreshCurrentView(app) {
        try {
            app.showLoadingState();
            
            // 重新加载数据
            const { rooms } = await loadRooms(app.API_BASE);
            
            // 更新StateModule中的缓存
            StateModule.setCache('rooms', rooms);
            
            // 更新当前视图
            const currentNode = StateModule.getSelectedNode();
            if (currentNode) {
                // 从重新加载的房间数据中找到当前节点的最新版本
            const updatedNode = findNodeById(rooms, currentNode.id || currentNode._id);
            if (updatedNode) {
                // 检查当前视图是否为仪表盘，如果是则跳过，避免自动切回存储空间界面
                if (!(app.dashboardModule && app.dashboardModule.isVisible) && app.currentView !== 'dashboard') {
                    this.handleNodeSelect(app, updatedNode);
                }
            }
            } else if (app.dashboardModule && app.dashboardModule.isVisible) {
                app.dashboardModule.loadDashboardDataFromServer();
            } else if (app.materialsModule && app.materialsModule.isVisible) {
                app.materialsModule.loadMaterials();
            } else if (app.inventoryModule && app.inventoryModule.isVisible) {
                app.inventoryModule.loadInventory();
            } else if (app.storageModule && app.storageModule.isVisible) {
                app.storageModule.refresh();
            } else {
                // 默认显示房间列表
                app.rooms = rooms;
            }
        } catch (error) {
            console.error('刷新视图失败:', error);
            app.showError('刷新视图失败: ' + error.message);
        } finally {
            app.hideLoadingState();
        }
    },
    
    /**
     * 处理添加物品点击事件
     */
    handleAddItemClick(app) {
        // 优先获取当前选中的节点，如果没有则获取当前选中的存储容器
        let currentNode = StateModule.getSelectedNode();
        if (!currentNode) {
            currentNode = StateModule.getSelectedStorageContainer();
        }
        
        if (!currentNode) {
            app.showError('请先选择一个房间或容器');
            return;
        }
        
        app.itemForm.clearForm();
        app.itemForm.setContainerId(currentNode.id);
        app.itemForm.open();
    },
    
    /**
     * 处理添加容器点击事件
     */
    handleAddContainerClick(app) {
        // 优先获取当前选中的节点，如果没有则获取当前选中的存储容器
        let currentNode = StateModule.getSelectedNode();
        if (!currentNode) {
            currentNode = StateModule.getSelectedStorageContainer();
        }
        
        if (!currentNode) {
            app.showError('请先选择一个房间或容器');
            return;
        }
        
        // 根据当前选中节点的类型决定是添加到房间还是添加为子容器
        // 使用更灵活的判断方式，不严格依赖于type属性
        if (currentNode.type === 'room' || isContainerNode(currentNode)) {
            app.containerForm.clearForm();
            if (currentNode.type === 'room') {
                // 添加到房间
                app.containerForm.setParentContainerId(null);
                app.containerForm.setParentContainerName(currentNode.name);
            } else {
                // 添加为子容器
                app.containerForm.setParentContainerId(currentNode.id);
                app.containerForm.setParentContainerName(currentNode.name);
            }
            app.containerForm.open();
        } else {
            app.showError('请选择一个有效的房间或容器');
        }
    },
    
    /**
     * 处理容器选择
     */
    handleContainerSelect(app, container) {
        this.handleNodeSelect(app, container);
    },
    
    /**
     * 处理存储容器选择
     */
    handleStorageContainerSelect(app, container) {
        this.handleNodeSelect(app, container);
    },
    
    /**
     * 显示存储容器内容
     */
    showStorageContainerContents(app, container) {
        this.handleNodeSelect(app, container);
    },
    
    /**
     * 更新添加物品按钮状态
     */
    updateAddItemButton(app, node) {
        const addItemToContainerBtn = document.getElementById('addItemToContainerBtn');
        
        if (!addItemToContainerBtn) return;
        
        // 检查是否为房间或容器节点
        const isRoom = node && node.type === 'room';
        const isContainer = node && !isRoom && (node.id || node._id) && (node.containers || node.items || node.type || node.containerType);
        
        if (node && node.type !== 'overview' && (isRoom || isContainer)) {
            addItemToContainerBtn.style.display = 'inline-block';
            
            // 更新按钮文本
            const buttonText = isRoom ? '添加容器' : '添加物品';
            const addItemToContainerBtnText = document.getElementById('addItemToContainerBtnText');
            if (addItemToContainerBtnText) {
                addItemToContainerBtnText.textContent = buttonText;
            } else {
                // 兼容旧版本
                addItemToContainerBtn.innerHTML = `<i class="fas fa-plus"></i> ${buttonText}`;
            }
        } else {
            addItemToContainerBtn.style.display = 'none';
        }
    },
    
    /**
     * 显示房间容器
     */
    showRoomContainers(app, room) {
        // 避免循环调用：只有当房间不是通过handleNodeSelect传入时才设置选中节点
        // 因为handleNodeSelect已经设置了currentNodeId
        if (!room.preventNodeSelect) {
            // 设置当前选中的节点
            StateModule.setSelectedNode(room);
        }
        
        // 防御性检查确保storageContainersGrid存在
        if (app.storageContainersGrid && typeof app.storageContainersGrid.showContainers === 'function') {
            // 房间容器显示逻辑
            app.storageContainersGrid.showContainers(room.containers || [], room);
        } else {
            console.error('❌ UIHandlersModule: app.storageContainersGrid 未初始化或缺少showContainers方法');
        }
        
        app.showContainersSection();
        app.hideSearchResults();
        if (typeof app.updateCurrentPath === 'function') {
            app.updateCurrentPath(room);
        }
        if (typeof app.updateContainerCount === 'function') {
            app.updateContainerCount(room.containers ? room.containers.length : 0);
        }
        if (typeof app.updateItemCount === 'function') {
            app.updateItemCount(0);
        }
    },
    
    /**
     * 显示容器内容
     */
    showContainerContents(app, container) {
        // 容器内容显示逻辑
        const subContainers = getDirectSubContainers(container);
        
        // 总是显示子容器列表，如果有的话
        if (subContainers.length > 0) {
            // 防御性检查确保storageContainersGrid存在
            if (app.storageContainersGrid && typeof app.storageContainersGrid.showContainers === 'function') {
                app.storageContainersGrid.showContainers(subContainers, container);
            } else {
                console.error('❌ UIHandlersModule: app.storageContainersGrid 未初始化或缺少showContainers方法');
            }
            
            if (typeof app.showContainersSection === 'function') {
                app.showContainersSection();
            }
            if (typeof app.updateContainerCount === 'function') {
                app.updateContainerCount(subContainers.length);
            }
        } else {
            if (typeof app.hideContainersSection === 'function') {
                app.hideContainersSection();
            }
            if (typeof app.updateContainerCount === 'function') {
                app.updateContainerCount(0);
            }
        }
        
        // 总是显示当前容器及其所有子容器中的物品
        const filteredItems = collectAllItems(container);
        const itemStatusConfig = StateModule.getCache('itemStatusConfig') || [];
        console.log('showContainerContents itemStatusConfig:', itemStatusConfig);
        
        // 防御性检查storageItemTable和showItems方法
        if (app.storageItemTable && typeof app.storageItemTable.showItems === 'function') {
            app.storageItemTable.showItems(filteredItems, { type: container.type }, itemStatusConfig);
        } else {
            console.error('❌ UIHandlersModule: app.storageItemTable 未初始化或缺少showItems方法');
        }
        
        // 防御性检查其他方法调用
        if (typeof app.updateItemCount === 'function') {
            app.updateItemCount(filteredItems.length);
        }
        
        if (typeof app.updateCurrentPath === 'function') {
            app.updateCurrentPath(container);
        }
        
        if (typeof app.hideSearchResults === 'function') {
            app.hideSearchResults();
        }
    },
    
    /**
     * 显示搜索结果
     */
    showSearchResults(app) {
        const searchResultsContainer = document.getElementById('searchResultsContainer');
        if (searchResultsContainer) {
            searchResultsContainer.style.display = 'block';
        }
    },
    
    /**
     * 隐藏搜索结果
     */
    hideSearchResults(app) {
        const searchResultsContainer = document.getElementById('searchResultsContainer');
        if (searchResultsContainer) {
            searchResultsContainer.style.display = 'none';
        }
    },
    
    /**
     * 显示容器区域
     */
    showContainersSection(app) {
        const containersSection = document.getElementById('containersSection');
        if (containersSection) {
            containersSection.style.display = 'block';
        }
    },
    
    /**
     * 隐藏容器区域
     */
    hideContainersSection(app) {
        const containersSection = document.getElementById('containersSection');
        if (containersSection) {
            containersSection.style.display = 'none';
        }
    },
    
    /**
     * 更新容器数量
     */
    updateContainerCount(app, count) {
        const containerCount = document.getElementById('containerCount');
        if (containerCount) {
            containerCount.textContent = count;
        }
    },
    
    /**
     * 更新物品数量
     */
    updateItemCount(app, count) {
        if (count !== undefined) {
            const itemCountElement = document.getElementById('itemCount');
            if (itemCountElement) {
                itemCountElement.textContent = count;
            }
        }
    },
    
    /**
     * 显示加载状态
     */
    showLoadingState() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        } else {
            // 创建简单的加载指示器
            const overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                font-size: 18px;
                font-weight: bold;
            `;
            overlay.textContent = '加载中...';
            document.body.appendChild(overlay);
        }
    },
    
    /**
     * 隐藏加载状态
     */
    hideLoadingState() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    },
    
    /**
     * 显示错误消息
     */
    showError(message) {
        console.error('❌ 错误:', message);
        alert(message);
    },
    
    /**
     * 显示全局错误
     */
    showGlobalError(title, message) {
        // 全局错误显示逻辑
        const errorModal = document.createElement('div');
        errorModal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 24px;
            border: 1px solid #ddd;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            max-width: 400px;
            width: 90%;
            border-radius: 4px;
        `;
        
        errorModal.innerHTML = `
            <h3 style="color: #dc3545; margin-top: 0;">${title}</h3>
            <p>${message}</p>
            <button style="
                background-color: #dc3545;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
            " onclick="this.parentElement.remove()">关闭</button>
        `;
        
        document.body.appendChild(errorModal);
    },
    
    /**
     * 显示成功消息
     */
    showMessage(message, type = 'success') {
        // 消息显示逻辑
        const messageContainer = document.createElement('div');
        messageContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 16px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        if (type === 'success') {
            messageContainer.style.backgroundColor = '#28a745';
        } else if (type === 'error') {
            messageContainer.style.backgroundColor = '#dc3545';
        } else {
            messageContainer.style.backgroundColor = '#17a2b8';
        }
        
        messageContainer.textContent = message;
        document.body.appendChild(messageContainer);
        
        // 自动关闭
        setTimeout(() => {
            messageContainer.remove();
        }, 3000);
    },
    
    /**
     * 隐藏所有内容区域
     */
    hideAllContentSections() {
        const contentSections = [
            'dashboardSection',
            'inventorySection',
            'materialsSection',
            'storageOverviewSection',
            'containersSection',
            'itemsSection',
            'storageItemsSection',
            'storageContainersSection'
        ];
        
        contentSections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                section.style.display = 'none';
            }
        });
    },
    
    /**
     * 更新当前路径显示
     */
    updateCurrentPath(app, node) {
        const path = this.getNodePath(app, node);
        const currentPath = document.getElementById('mainCurrentPath');
        const storageCurrentPath = document.getElementById('storageCurrentPath');
        
        // 确保路径数组不为空
        if (!path || path.length === 0) {
            console.warn('Empty path for node:', node);
            return;
        }
        
        // 生成路径HTML，但不使用内联onclick
        const pathHTML = path.map((segment, index) => {
            const isLast = index === path.length - 1;
            if (isLast) {
                return `<span class="path-segment active">${segment.name}</span>`;
            }
            return `<span class="path-segment clickable" data-segment-id="${segment.id}">${segment.name}</span> / `;
        }).join('');
        
        // 更新DOM
        if (currentPath) {
            currentPath.innerHTML = pathHTML;
            // 添加事件监听器
            this.addBreadcrumbEventListeners(currentPath, app);
        }
        
        if (storageCurrentPath) {
            storageCurrentPath.innerHTML = pathHTML;
            // 添加事件监听器
            this.addBreadcrumbEventListeners(storageCurrentPath, app);
        }
    },
    
    /**
     * 为面包屑添加事件监听器
     */
    addBreadcrumbEventListeners(element, app) {
        // 先移除所有现有的事件监听器（使用事件委托）
        element.onclick = (event) => {
            const segment = event.target.closest('.path-segment.clickable');
            if (segment && segment.dataset.segmentId) {
                const segmentId = segment.dataset.segmentId;
                this.navigateToPathSegment(app, segmentId);
            }
        };
    },
    
    /**
     * 获取节点路径
     */
    getNodePath(app, node) {
        // 递归查找所有父节点并返回 root-to-current 顺序的路径，使用 seenIds 避免处理重复节点
        const seenIds = new Set();
        
        const findPathRecursively = (currentNode) => {
            // 快速返回无效节点
            if (!currentNode?.id || seenIds.has(currentNode.id)) return [];
            seenIds.add(currentNode.id);

            // 统一查找父节点的逻辑
            const findParent = (id) => {
                const rooms = StateModule.getCache('rooms') || [];
                const containers = StateModule.getCache('containers') || [];
                
                // 先在所有容器中查找
                let parent = findNodeById(containers, id);
                if (parent) return parent;
                
                // 再在所有房间中查找
                parent = findNodeById(rooms, id);
                if (parent) return parent;
                
                return null;
            };

            let parentPath = [];
            const parentId = currentNode.parentId;
            if (parentId) {
                const parentNode = findParent(parentId);
                if (parentNode) parentPath = findPathRecursively(parentNode);
            }

            return [...parentPath, { id: currentNode.id, name: currentNode.name }];
        };
        
        let path;
        if (node.id === 'overview') {
            // 总览节点
            path = [node];
        } else {
            // 普通节点
            path = findPathRecursively(node);
            
            // 添加总览级别
            if (StateModule.getIsInStorageOverview()) {
                path.unshift({ id: 'overview', name: '总览' });
            }
        }
        
        return path;
    },
    
    /**
     * 根据ID查找节点
     */
    async navigateToPathSegment(app, id) {
        try {
            if (id === 'home' || id === 'storage_root' || id === 'overview') {
                // 导航到总览时清除选中的容器，确保总览模式正确显示
                StateModule.setSelectedStorageContainer(null);
                StateModule.setSelectedNode(null);
                StateModule.setCurrentNodeId('overview');
                
                // 为总览导航添加数据刷新逻辑
                if (app.storageModule && typeof app.storageModule.loadStorageData === 'function') {
                    await app.storageModule.loadStorageData();
                }
                
                // 导航到总览
                await app.showStorageOverview();
                return;
            }
            
            // 确保存储模块已初始化
            if (!app.storageModule) {
                // 如果存储模块未初始化，先调用showStorageOverview来初始化它
                await app.showStorageOverview();
                // 初始化后再次检查
                if (!app.storageModule) {
                    console.error('navigateToPathSegment: 初始化存储模块失败');
                    return;
                }
            }
            
            // 获取所有可能的节点源
            const allRooms = StateModule.getCache('rooms') || [];
            console.log('navigateToPathSegment: 所有房间:', allRooms);
            const allContainers = StateModule.getCache('containers') || [];
            console.log('navigateToPathSegment: 所有容器:', allContainers);
            const allNodes = [...allRooms, ...allContainers];
            console.log('navigateToPathSegment: 所有节点:', allNodes);
            
            // 尝试找到对应的容器节点
            let targetContainer = findNodeById(allNodes, id, allRooms);
            
            // 如果还是没找到，尝试直接在缓存的所有容器中查找
            if (!targetContainer) {
                targetContainer = allContainers.find(container => 
                    String(container.id) === String(id) || 
                    String(container._id) === String(id) ||
                    String(container.name) === String(id) // 作为最后的尝试，按名称匹配
                );
            }
            
            // 如果找到容器，更新视图
            if (targetContainer) {
                console.log('navigateToPathSegment: 找到目标容器:', targetContainer.name, targetContainer.id || targetContainer._id);
                
                // 先更新状态，使用原始容器对象
                StateModule.setCurrentNodeId(targetContainer.id || targetContainer._id);
                StateModule.setSelectedStorageContainer(targetContainer);
                StateModule.setSelectedNode(targetContainer);
                
                // 确保容器数据是最新的，先重新加载存储数据
                if (app.storageModule && typeof app.storageModule.loadStorageData === 'function') {
                    await app.storageModule.loadStorageData();
                }
                
                // 重新获取完整的容器数据
                const updatedContainers = StateModule.getCache('containers') || [];
                const updatedRooms = StateModule.getCache('rooms') || [];
                const allUpdatedNodes = [...updatedContainers, ...updatedRooms];
                const fullTargetContainer = findNodeById(allUpdatedNodes, targetContainer.id || targetContainer._id);
                
                // 显示容器内容，使用完整的容器对象
                app.storageModule.showContainerContents(fullTargetContainer || targetContainer);
                
                // 确保面包屑导航更新
                UIHandlersModule.updateCurrentPath(app, fullTargetContainer || targetContainer);
            } else {
                console.error(`navigateToPathSegment: 未找到ID为${id}的容器节点`);
                // 即使未找到目标容器，也应该确保界面状态正确
                StateModule.setSelectedStorageContainer(null);
                StateModule.setSelectedNode(null);
                StateModule.setCurrentNodeId('overview');
                await app.showStorageOverview();
            }
        } catch (error) {
            console.error('navigateToPathSegment: 导航过程中发生错误:', error);
            // 错误情况下也应该回到总览页面
            StateModule.setSelectedStorageContainer(null);
            StateModule.setSelectedNode(null);
            StateModule.setCurrentNodeId('overview');
            await app.showStorageOverview();
        }
    },
    
    /**
     * 更新活动菜单项
     */
    updateActiveMenuItem(activeMenuItemId) {
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.getElementById(activeMenuItemId);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }
};

export default UIHandlersModule;