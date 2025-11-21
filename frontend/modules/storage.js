import { getStorageData, getContainerCount, loadItemStatusConfig } from './data.js';
import { collectAllContainerIds, collectAllItems, findNodeById, getDirectSubContainers } from './utils.js';
import eventBus from './eventBus.js';
import StateModule from './state.js';
import UIHandlersModule from './ui-handlers.js';
import { ContainerGrid } from '../components/ContainerGrid.js';

export class StorageModule {
    constructor(app) {
        this.app = app; // 暂时保留app引用，后续可考虑完全移除
        this.apiBase = app.API_BASE;
        this.eventBus = eventBus;
        // 保存当前的父级信息引用
        this.currentParentInfo = { id: 'overview', name: '总览', type: 'overview' };
        
        // 订阅数据更新事件
        this.eventBus.subscribe('data-updated', () => {
            // 数据更新时自动重新加载存储数据
            this.loadStorageData();
        });
        
        // 订阅刷新视图事件
        this.eventBus.subscribe('refresh-view', () => {
            this.refreshStorageOverview();
        });
        
        // 延迟设置容器网格点击事件，确保组件已完全初始化
        setTimeout(() => {
            // 设置容器网格点击事件
            if (this.app && this.app.storageContainersGrid && typeof this.app.storageContainersGrid.setOnContainerSelect === 'function') {
                this.app.storageContainersGrid.setOnContainerSelect((container) => {
                    // 保存当前选中的容器和节点
                    StateModule.setSelectedStorageContainer(container);
                    StateModule.setSelectedNode(container);
                    
                    // 查找容器的实际父级，确保层级关系正确
                    let actualParent = null;
                    if (container.parentId) {
                        actualParent = findNodeById(StateModule.getCache('rooms'), container.parentId);
                    } else if (this.currentParentInfo) {
                        actualParent = this.currentParentInfo;
                    }
                    
                    // 确保父容器信息已设置到当前容器中
                    if (actualParent && !container.parent) {
                        container.parent = actualParent;
                    }
                    
                    // 更新路径显示
                    if (this.app && typeof UIHandlersModule.updateCurrentPath === 'function') {
                        UIHandlersModule.updateCurrentPath(this.app, container);
                    }
                    
                    // 加载当前容器及其所有子容器中的物品并显示
                    const filteredItems = collectAllItems(container);
            const itemStatusConfig = StateModule.getCache('itemStatusConfig') || [];
            // 通过app实例的storageItemTable来显示物品列表
            if (this.app && this.app.storageItemTable && typeof this.app.storageItemTable.showItems === 'function') {
                this.app.storageItemTable.showItems(filteredItems, { type: container.type }, itemStatusConfig);
            } else {
                console.error('❌ StorageModule: app.storageItemTable 未初始化或缺少showItems方法');
            }
            
            // 更新物品数量显示
            this.updateItemCount(filteredItems.length);
            
            // 处理子容器 - 确保只显示直接子容器
            const directSubContainers = getDirectSubContainers(container);
            
            // 为每个直接子容器添加parent信息
            const subContainersWithParent = directSubContainers.map(subContainer => ({
                ...subContainer,
                parentId: container.type === 'room' ? container.id : subContainer.parentId,
                parentName: container.name
            }));
            
            // 更新当前父级信息
            this.currentParentInfo = container;
            
            // 更新容器数量显示
            this.updateContainerCount(subContainersWithParent.length);
            
            // 检查容器网格组件是否存在
              if (this.app && this.app.storageContainersGrid) {
                  try {
                      // 使用正确的refresh方法而不是refreshContainersGrid
                      if (typeof this.app.storageContainersGrid.refresh === 'function') {
                          this.app.storageContainersGrid.refresh(subContainersWithParent, {
                              type: container.type,
                              name: container.name,
                              id: container.id
                          });
                      } else if (typeof this.app.storageContainersGrid.showContainers === 'function') {
                          // 备选方案：直接使用showContainers方法
                          this.app.storageContainersGrid.showContainers(subContainersWithParent, {
                              type: container.type,
                              name: container.name,
                              id: container.id
                          });
                      } else {
                          console.error('❌ StorageModule: 容器网格组件不具有必要的刷新方法');
                          throw new Error('Container grid missing refresh method');
                      }
                  } catch (error) {
                      console.error('❌ StorageModule: 刷新容器网格时出错:', error);
                      // 尝试重新初始化容器网格组件
                      try {
                          // 检查ContainerGrid是否已加载
                          if (typeof window.ContainerGrid !== 'undefined') {
                              this.app.storageContainersGrid = new window.ContainerGrid('storageContainersGrid');
                              console.log('✅ StorageModule: 已尝试重新初始化容器网格组件');
                              // 重新尝试显示容器
                              if (typeof this.app.storageContainersGrid.showContainers === 'function') {
                                  this.app.storageContainersGrid.showContainers(subContainersWithParent, {
                                      type: container.type,
                                      name: container.name,
                                      id: container.id
                                  });
                              }
                          } else {
                              console.error('❌ StorageModule: ContainerGrid组件未加载');
                          }
                      } catch (reinitError) {
                          console.error('❌ StorageModule: 重新初始化容器网格失败:', reinitError);
                      }
                  }
              } else {
                  console.error('❌ StorageModule: 容器网格组件不存在');
              }
        });
    }});
    
    // 初始化时自动加载数据
    this.loadStorageData();
    }

    async refresh() {
        await this.loadStorageData();
    }

    /**
     * 刷新存储空间总览信息
     */
    refreshStorageOverview() {
        // 获取当前节点ID
        const currentNodeId = StateModule.getCurrentNodeId();
        
        // 根据当前节点ID获取节点信息
        let currentNode = null;
        if (currentNodeId === 'overview') {
            currentNode = { id: 'overview', name: '总览', type: 'overview' };
        } else {
            // 在所有房间和容器中查找节点
            const allNodes = [...StateModule.getCache('rooms'), ...StateModule.getCache('containers')];
            currentNode = findNodeById(allNodes, currentNodeId);
        }
        
        if (!currentNode) return;
        
        // 1. 刷新面包屑导航栏
        UIHandlersModule.updateCurrentPath(this.app, currentNode);
        
        // 2. 刷新存储空间列表
        this.refreshStorageList(currentNodeId);
        
        // 3. 刷新物品列表
        this.refreshItemList(currentNodeId);
    }

    /**
     * 刷新存储空间列表
     */
    refreshStorageList(currentNodeId) {
        // 使用app实例的storageContainersGrid来管理容器网格
        
        if (currentNodeId === 'overview') {
            // 总览模式：显示所有房间
            const rooms = StateModule.getCache('rooms') || [];
            
            // 防御性检查确保app.storageContainersGrid存在且showContainers为函数
            if (this.app && this.app.storageContainersGrid && typeof this.app.storageContainersGrid.showContainers === 'function') {
                this.app.storageContainersGrid.showContainers(rooms, 'overview');
            } else {
                console.error('❌ StorageModule: app.storageContainersGrid 未初始化或缺少showContainers方法');
            }
            
            // 更新容器数量显示
            this.updateContainerCount(rooms.length);
        } else {
            // 普通模式：显示当前节点的子容器
            let containers = [];
            const allContainers = StateModule.getCache('containers') || [];
            const allRooms = StateModule.getCache('rooms') || [];
            
            // 1. 首先从所有容器中查找父容器ID等于当前节点ID的容器
            containers = allContainers.filter(container => 
                String(container.parentId) === String(currentNodeId) || 
                String(container.roomId) === String(currentNodeId) ||
                String(container.areaId) === String(currentNodeId)
            );
            
            // 2. 同时检查当前节点对象中可能存在的containers属性
            const allNodes = [...allRooms, ...allContainers];
            const currentNode = findNodeById(allNodes, currentNodeId);
            
            if (currentNode && currentNode.containers && currentNode.containers.length > 0) {
                // 如果currentNode中已经包含containers，确保我们没有遗漏任何容器
                const containerIdsInNode = new Set(currentNode.containers.map(c => String(c.id || c._id)));
                const containersFromCache = containers.filter(c => containerIdsInNode.has(String(c.id || c._id)));
                const containersNotInCache = currentNode.containers.filter(c => 
                    !containersFromCache.some(cacheContainer => 
                        String(cacheContainer.id || cacheContainer._id) === String(c.id || c._id)
                    )
                );
                
                // 合并两种方式找到的容器，避免重复
                containers = [...containersFromCache, ...containersNotInCache];
            }
            
            // 防御性检查确保app.storageContainersGrid存在且showContainers为函数
            if (this.app && this.app.storageContainersGrid && typeof this.app.storageContainersGrid.showContainers === 'function') {
                this.app.storageContainersGrid.showContainers(containers, currentNodeId);
            } else {
                console.error('❌ StorageModule: app.storageContainersGrid 未初始化或缺少showContainers方法');
            }
            
            // 更新容器数量显示
            this.updateContainerCount(containers.length);
        }
    }

    /**
     * 刷新物品列表
     */
    refreshItemList(currentNodeId) {
        // 过滤出物品数据集合中storageUnitId字段与当前节点或其子容器ID相匹配的物品
        let filteredItems = [];
        if (currentNodeId === 'overview') {
            // 总览模式：显示所有物品
            const overviewNode = {
                id: 'overview',
                name: '总览',
                type: 'overview',
                containers: StateModule.getCache('rooms')
            };
            
            // 首先从嵌套结构中收集物品
            filteredItems = collectAllItems(overviewNode);
            
            // 获取所有物品数据作为备用
            const allItems = StateModule.getCache('items') || [];
            
            // 创建物品ID的Map用于去重
            const itemMap = new Map();
            
            // 先添加从嵌套结构中收集的物品
            filteredItems.forEach(item => {
                const itemId = item.id || item._id;
                if (itemId) {
                    itemMap.set(itemId, item);
                }
            });
            
            // 添加直接从items缓存中获取的物品，确保没有遗漏
            allItems.forEach(item => {
                const itemId = item.id || item._id;
                if (itemId && !itemMap.has(itemId)) {
                    // 为未关联到容器的物品设置默认信息
                    itemMap.set(itemId, {
                        ...item,
                        containerName: '未分配',
                        containerId: null
                    });
                }
            });
            
            // 将Map转换回数组
            filteredItems = Array.from(itemMap.values());
        } else {
            // 普通模式：显示当前节点及其所有子容器中的物品
            const allNodes = [...StateModule.getCache('rooms'), ...StateModule.getCache('containers')];
            const currentNode = findNodeById(allNodes, currentNodeId);
            
            if (currentNode) {
                // 直接使用collectAllItems函数，它会自动设置containerName和containerId
                filteredItems = collectAllItems(currentNode);
            }
        }
        
        console.log(`刷新物品列表，当前模式: ${currentNodeId === 'overview' ? '总览' : '容器'}，物品数量: ${filteredItems.length}`);
        
        // 更新物品列表
        const itemStatusConfig = StateModule.getCache('itemStatusConfig') || [];
        if (this.app && this.app.storageItemTable && typeof this.app.storageItemTable.showItems === 'function') {
            this.app.storageItemTable.showItems(filteredItems, { type: currentNodeId === 'overview' ? 'overview' : 'container' }, itemStatusConfig);
        } else {
            console.error('❌ StorageModule: app.storageItemTable 未初始化或缺少showItems方法');
        }
        
        // 更新物品数量显示
        this.updateItemCount(filteredItems.length);
    }

    /**
     * 显示容器内容
     */
    showContainerContents(container) {
        // 设置当前节点ID和选中的容器
        StateModule.setCurrentNodeId(container.id);
        StateModule.setSelectedStorageContainer(container);
        StateModule.setSelectedNode(container);
        
        // 更新当前父级信息
        this.currentParentInfo = container;
        
        // 显示面包屑导航
        const breadcrumbSection = document.querySelector('.breadcrumb');
        if (breadcrumbSection) {
            breadcrumbSection.style.display = 'block';
        }
        
        // 更新面包屑导航
        UIHandlersModule.updateCurrentPath(this.app, container);
        
        // 正确刷新储物空间列表和物品列表
        this.refreshStorageList(container.id);
        this.refreshItemList(container.id);
        
        // 显示添加容器和添加物品按钮
        const addContainerBtn = document.getElementById('addContainerBtn');
        if (addContainerBtn) {
            addContainerBtn.style.display = 'block';
        }
        
        const addItemBtn = document.getElementById('addItemBtn');
        if (addItemBtn) {
            addItemBtn.style.display = 'block';
        }
        
        // 更新添加物品按钮状态
        UIHandlersModule.updateAddItemButton(container);
    }
    
    /**
     * 更新物品数量显示
     */
    updateItemCount(count) {
        const storageItemCountElement = document.getElementById('storageItemCount');
        if (storageItemCountElement) {
            storageItemCountElement.textContent = count;
        }
    }
    
    /**
     * 更新容器数量显示
     */
    updateContainerCount(count) {
        const containerCountElement = document.getElementById('storageContainerCount');
        if (containerCountElement) {
            containerCountElement.textContent = count;
        }
    }
    
    /**
     * 显示存储总览
     */
    async showStorageOverview(app) {
        UIHandlersModule.hideAllContentSections();
        UIHandlersModule.updateActiveMenuItem('storageOverviewMenu');
        
        // 直接操作DOM元素
        const storageOverviewSection = document.getElementById('storageOverviewSection');
        const breadcrumbSection = document.querySelector('.breadcrumb');
        
        if (storageOverviewSection) {
            storageOverviewSection.style.display = 'block';
        }
        if (breadcrumbSection) {
            breadcrumbSection.style.display = 'block';
        }
        
        StateModule.setIsInStorageOverview(true);

        // 检查数据是否已加载，如果没有则重新加载
        if (!StateModule.getCache('rooms') || StateModule.getCache('rooms').length === 0) {
            await this.loadStorageData();
        }
        
        // 检查物品状态配置是否已加载，如果没有则重新加载
        if (!StateModule.getCache('itemStatusConfig') || StateModule.getCache('itemStatusConfig').length === 0) {
            const itemStatusConfig = await loadItemStatusConfig(this.apiBase);
            StateModule.setCache('itemStatusConfig', itemStatusConfig || []);
        }
        
        const overviewNode = {
            id: 'overview',
            name: '总览',
            type: 'overview',
            containers: StateModule.getCache('rooms')
        };

        // 优先使用传入的app参数，如果没有则使用this.app
        const currentApp = app || this.app;
        UIHandlersModule.updateCurrentPath(currentApp, overviewNode);
        // 设置当前节点ID为总览
        StateModule.setCurrentNodeId('overview');
        
        // 刷新所有三个模块
        console.log('showStorageOverview: 房间数据:', StateModule.getCache('rooms'));
        console.log('showStorageOverview: 容器数据:', StateModule.getCache('containers'));
        console.log('showStorageOverview: 物品数据:', StateModule.getCache('items'));
        this.refreshStorageOverview();
        
        UIHandlersModule.updateAddItemButton(overviewNode);
        this.currentParentInfo = { id: 'overview', name: '总览', type: 'overview' };

        // 获取添加容器和添加物品按钮
        const addContainerBtn = document.getElementById('addContainerBtn');
        const addItemBtn = document.getElementById('addItemBtn');
        
        // 在总览层级隐藏添加容器和添加物品按钮
        if (addContainerBtn) addContainerBtn.style.display = 'none';
        if (addItemBtn) addItemBtn.style.display = 'none';
        
        // 使用后端API获取容器总数，避免前端计算
        const totalContainers = await getContainerCount(this.apiBase);
        
        // 更新容器数量显示
        const containerCountElement = document.getElementById('storageContainerCount');
        if (containerCountElement) {
            containerCountElement.textContent = totalContainers;
        }
        
        // 检查是否有预先选中的容器，但不自动导航到它
        // 这样保证从面包屑导航可以回到总览模式
        const selectedContainer = StateModule.getSelectedStorageContainer();
        const currentNodeId = StateModule.getCurrentNodeId();
        if (selectedContainer && currentNodeId !== 'overview') {  
            // 只有在不是从总览导航来时才显示选中的容器
            // 直接调用自身方法，不再通过app实例
                this.showContainerContents(selectedContainer);
        } else {
            // 清除选中的容器，确保总览模式正确显示
            StateModule.setSelectedStorageContainer(null);
            // 显示初始房间列表
            // 使用统一的app实例引用
            const appInstance = app || this.app;
            
            // 增强的防御性检查
            if (!appInstance) {
                console.error('Error: Cannot refresh containers grid - app instance is null or undefined');
            } else if (!appInstance.storageContainersGrid) {
                console.error('Error: Cannot refresh containers grid - storageContainersGrid component is not initialized on app instance');
                // 尝试重新初始化ContainerGrid组件
                try {
                    if (typeof ContainerGrid === 'function') {
                        const containerGridElement = document.getElementById('storageContainersGrid');
                        if (containerGridElement) {
                            appInstance.storageContainersGrid = new ContainerGrid(containerGridElement);
                            console.log('ContainerGrid component reinitialized successfully');
                        } else {
                            console.error('Error: ContainerGrid element not found in DOM');
                        }
                    }
                } catch (error) {
                    console.error('Error reinitializing ContainerGrid:', error);
                }
            } else if (typeof appInstance.storageContainersGrid.refresh !== 'function') {
                console.error('Error: Cannot refresh containers grid - refresh method is not available');
            }
            
            // 再次检查后尝试调用
            if (appInstance && appInstance.storageContainersGrid && typeof appInstance.storageContainersGrid.refresh === 'function') {
                const roomsData = Array.isArray(StateModule.getCache('rooms')) ? StateModule.getCache('rooms') : [];
                console.log('Attempting to refresh containers grid with rooms data:', roomsData);
                appInstance.storageContainersGrid.refresh(roomsData, { type: '总览', name: '总览' });
            }

            // 再次隐藏按钮，确保在刷新后按钮仍然处于隐藏状态
            if (addContainerBtn) addContainerBtn.style.display = 'none';
            if (addItemBtn) addItemBtn.style.display = 'none';
            
            // 初始化时显示所有物品（总览下的所有物品）
            // 首先从嵌套结构中收集物品
            let allItems = collectAllItems(overviewNode);
            
            // 获取所有物品数据作为备用
            const itemsCache = StateModule.getCache('items') || [];
            
            // 创建物品ID的Map用于去重
            const itemMap = new Map();
            
            // 先添加从嵌套结构中收集的物品
            allItems.forEach(item => {
                const itemId = item.id || item._id;
                if (itemId) {
                    itemMap.set(itemId, item);
                }
            });
            
            // 添加直接从items缓存中获取的物品，确保没有遗漏
            itemsCache.forEach(item => {
                const itemId = item.id || item._id;
                if (itemId && !itemMap.has(itemId)) {
                    // 为未关联到容器的物品设置默认信息
                    itemMap.set(itemId, {
                        ...item,
                        containerName: '未分配',
                        containerId: null
                    });
                }
            });
            
            // 将Map转换回数组
            allItems = Array.from(itemMap.values());
            
            console.log('showStorageOverview: 物品总数:', allItems.length);
            const itemStatusConfig = StateModule.getCache('itemStatusConfig') || [];
            if (this.app && this.app.storageItemTable && typeof this.app.storageItemTable.showItems === 'function') {
                this.app.storageItemTable.showItems(allItems, { type: '总览' }, itemStatusConfig);
            } else {
                console.error('❌ StorageModule: app.storageItemTable 未初始化或缺少showItems方法');
            }
            
            // 显示物品列表区域
            const storageItemsSection = document.getElementById('storageItemsSection');
            const storageContainersSection = document.getElementById('storageContainersSection');
            if (storageItemsSection) {
                storageItemsSection.style.display = 'block';
            }
            if (storageContainersSection) {
                storageContainersSection.style.display = 'block';
            }

            // 在总览层级隐藏添加容器和添加物品按钮
            if (addContainerBtn) addContainerBtn.style.display = 'none';
            if (addItemBtn) addItemBtn.style.display = 'none';
            
            // 更新物品数量显示
            const storageItemCountElement = document.getElementById('storageItemCount');
            if (storageItemCountElement) {
                storageItemCountElement.textContent = allItems.length;
            }
        }
        
    }
    
    /**
     * 加载指定容器的直接子容器
     */
    loadStorageContainers(parentId) {
        // 设置当前节点ID
        StateModule.setCurrentNodeId(parentId === 'storage_root' || parentId === 'home' ? 'overview' : parentId);
        
        // 更新当前路径
        let currentNode = null;
        if (parentId === 'overview' || parentId === 'storage_root' || parentId === 'home') {
            currentNode = { id: 'overview', name: '总览', type: 'overview' };
            StateModule.setSelectedStorageContainer(currentNode);
        } else {
            const allNodes = [...StateModule.getCache('rooms'), ...StateModule.getCache('containers')];
            currentNode = findNodeById(allNodes, parentId);
            StateModule.setSelectedStorageContainer(currentNode);
        }
        
        if (currentNode) {
            // 调用刷新方法更新所有模块
            this.refreshStorageOverview();
        }
    }

    
    /**
     * 加载存储数据（房间、容器、物品）
     */
    async loadStorageData() {
        try {
            // 清除旧的缓存数据，确保加载最新数据
            StateModule.setCache('rooms', []);
            StateModule.setCache('items', []);
            
            // 并行加载存储数据和物品状态配置
            const [data, itemStatusConfig] = await Promise.all([
                getStorageData(this.apiBase),
                loadItemStatusConfig(this.apiBase)
            ]);
            
            console.log('Data loaded from API:', data);
            console.log('Item status config loaded:', itemStatusConfig);
            
            // 更新缓存
            StateModule.setCache('rooms', data.rooms || []);
            StateModule.setCache('containers', data.containers || []);
            StateModule.setCache('items', data.items || []);
            StateModule.setCache('itemStatusConfig', itemStatusConfig || []);
            
            // Only refresh if already in storage overview to avoid unintended navigation
            if (StateModule.getIsInStorageOverview()) {
                // Refresh current container if selected
                if (StateModule.getSelectedStorageContainer()) {
                    this.loadStorageContainers(StateModule.getSelectedStorageContainer().id);
                } else {
                    // Reload storage overview if no specific container is selected
                    this.showStorageOverview();
                }
            }
        } catch (error) {
            console.error('Failed to load storage data:', error);
        }
    }
}