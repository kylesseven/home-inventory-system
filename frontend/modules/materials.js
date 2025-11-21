import { loadMaterialsByCategory } from './data.js';
import { findNodeById } from './utils.js';
import StateModule from './state.js';
import eventBus from './eventBus.js';
import UIHandlersModule from './ui-handlers.js';

class MaterialsModule {
    constructor(app) {
        this.app = app;
        this.apiBaseUrl = app.API_BASE;
        this.eventBus = eventBus;
        
        // 分页相关属性
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.materials = []; // 存储所有物料数据
        
        // 订阅数据更新事件
        this.eventBus.subscribe('data-updated', () => {
            this.loadMaterialsByCategory();
        });
    }

    /**
     * 显示物料管理页面
     */
    showMaterials() {
        UIHandlersModule.hideAllContentSections();
        UIHandlersModule.updateActiveMenuItem('materialsMenu');
        this.loadMaterialsByCategory();
    }

    /**
     * 调用后端API获取所有物品
     */
    async fetchAllItems() {
        const response = await fetch(`${this.apiBaseUrl}/items`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('获取物品数据失败');
        }

        const result = await response.json();
        return result.data;
    }

    /**
     * 按种类加载所有物料
     */
    async loadMaterialsByCategory() {
        try {
            // 使用UIHandlersModule显示加载状态
            UIHandlersModule.showLoadingState();
            
            console.log('API Base URL:', this.apiBaseUrl);
            console.log('Full API URL for areas:', `${this.apiBaseUrl}/areas`);
            
            // 获取区域数据以构建位置名称映射
            const areasResponse = await fetch(`${this.apiBaseUrl}/areas`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Response status for areas:', areasResponse.status);
            console.log('Response ok:', areasResponse.ok);
            console.log('Response headers:', JSON.stringify([...areasResponse.headers]));
            
            if (!areasResponse.ok) {
                const errorText = await areasResponse.text();
                console.error('Response text for areas:', errorText);
                throw new Error('获取区域数据失败');
            }
            
            const areasResult = await areasResponse.json();
            console.log('Areas result:', areasResult);
            // 保存区域数据到自己的缓存，避免覆盖存储模块的rooms数据
            StateModule.setCache('materialAreas', areasResult.data);
            
            // 调用后端API获取所有物品
            const allItems = await this.fetchAllItems();
            console.log(`获取到${allItems.length}个物品数据`);
            
            // 按子类别合并物品并统计总数量
            const materialsByCategory = allItems.reduce((acc, item) => {
                const key = item.subcategory || '未分类';
                if (!acc[key]) {
                    acc[key] = {
                        subcategory: key,
                        totalQuantity: item.quantity,
                        items: [item]
                    };
                } else {
                    acc[key].totalQuantity += item.quantity;
                    acc[key].items.push(item);
                }
                return acc;
            }, {});
            
            // 将结果转换为数组
            const materialsArray = Object.values(materialsByCategory);
            console.log(`合并后得到${materialsArray.length}个子类别`);
            
            // 预构建容器ID到名称的映射缓存，提高查询效率（等待Promise完成）
            console.log('开始构建容器映射缓存...');
            await this.buildContainerMapCache(allItems);
            console.log('容器映射缓存构建完成');
            
            // 渲染物料表格
            console.log('开始渲染物料表格...');
            this.renderMaterialsTable(materialsArray);
            console.log('物料表格渲染完成');
            
        } catch (error) {
            let errorMessage = `加载物料失败: ${error.message}`;
            // Check if it's a network error (CORS, connection issues)
            if (error instanceof TypeError) {
                errorMessage = `加载物料失败: 网络错误或服务器不可达，请检查网络连接和CORS设置。错误详情：${error.message}`;
            }
            // 使用UIHandlersModule显示错误
            UIHandlersModule.showError(errorMessage);
            console.error('Error loading materials:', error);
        } finally {
            // 使用UIHandlersModule隐藏加载状态
            UIHandlersModule.hideLoadingState();
        }
    }
    
    /**
     * 根据容器ID直接从后端获取容器信息
     */
    async fetchContainerById(containerId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/storage_units/${containerId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                console.warn(`获取容器信息失败 (${containerId}):`, response.status);
                return null;
            }
            
            const result = await response.json();
            return result.success ? result.data : null;
        } catch (error) {
            console.error(`获取容器信息异常 (${containerId}):`, error);
            return null;
        }
    }
    
    /**
     * 构建容器ID到名称的映射缓存
     * 基于用户建议的优化：直接根据容器ID获取容器名称
     */
    async buildContainerMapCache(items) {
        // 创建容器映射缓存
        this.containerMap = {};
        
        // 收集所有使用中的容器ID
        const containerIds = new Set();
        items.forEach(item => {
            if (item.storageUnitId) {
                containerIds.add(String(item.storageUnitId));
            }
        });
        
        console.log('需要获取名称的容器ID集合:', Array.from(containerIds));
        
        // 首先尝试从缓存中获取容器名称
        const materialAreas = StateModule.getCache('materialAreas') || [];
        const rooms = StateModule.getCache('rooms') || [];
        
        // 从rooms缓存构建映射
        this.buildContainerMapFromNodes(rooms, containerIds);
        
        // 从materialAreas构建映射（如果在rooms中未找到）
        this.buildContainerMapFromNodes(materialAreas, containerIds);
        
        // 对于缓存中未找到的容器，直接从API获取
        const missingContainerIds = Array.from(containerIds).filter(id => 
            !this.containerMap[id] || this.containerMap[id] === '未知位置'
        );
        
        if (missingContainerIds.length > 0) {
            console.log('需要从API获取的容器ID:', missingContainerIds);
            
            // 并行请求所有缺失的容器信息
            const fetchPromises = missingContainerIds.map(id => this.fetchContainerById(id));
            const results = await Promise.allSettled(fetchPromises);
            
            results.forEach((result, index) => {
                const containerId = missingContainerIds[index];
                if (result.status === 'fulfilled' && result.value) {
                    this.containerMap[containerId] = result.value.name || `容器(${containerId})`;
                } else {
                    // 如果API请求失败，使用容器ID作为名称
                    this.containerMap[containerId] = `容器(${containerId})`;
                }
            });
        }
        
        console.log('构建的容器映射缓存:', this.containerMap);
    }
    
    /**
     * 从节点数组构建容器ID到名称的映射
     */
    buildContainerMapFromNodes(nodes, containerIds) {
        // 递归函数查找容器
        const findContainers = (nodesToSearch) => {
            if (!nodesToSearch || !Array.isArray(nodesToSearch)) return;
            
            nodesToSearch.forEach(node => {
                const nodeId = String(node.id || node._id);
                
                // 如果这个节点ID在需要的容器ID集合中，且尚未在映射中
                if (containerIds.has(nodeId) && !this.containerMap[nodeId]) {
                    this.containerMap[nodeId] = node.name || '未知位置';
                }
                
                // 递归查找子容器
                if (node.containers && Array.isArray(node.containers)) {
                    findContainers(node.containers);
                }
            });
        };
        
        findContainers(nodes);
    }

    /**
     * 渲染物料表格（支持异步位置信息获取）
     */
    async renderMaterialsTable(materials) {
        const container = document.getElementById('materialsTableContainer');
        if (!container) return;
        
        if (materials.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-boxes fa-3x"></i>
                    <p>没有找到任何物料</p>
                </div>
            `;
            return;
        }
        
        // 预加载所有容器信息（确保所有物料的容器名称都已准备好）
        // 收集所有需要的容器ID
        const allContainerIds = new Set();
        materials.forEach(material => {
            if (material.items) {
                material.items.forEach(item => {
                    if (item.storageUnitId) {
                        allContainerIds.add(String(item.storageUnitId));
                    }
                });
            }
        });
        
        // 检查哪些容器ID还没有有效名称
        const missingContainerIds = Array.from(allContainerIds).filter(id => 
            !this.containerMap || !this.containerMap[id] || this.containerMap[id] === '未知位置'
        );
        
        // 如果有缺失的容器信息，预先批量获取
        if (missingContainerIds.length > 0) {
            console.log('预加载缺失的容器信息:', missingContainerIds);
            const fetchPromises = missingContainerIds.map(id => this.fetchContainerById(id));
            const results = await Promise.allSettled(fetchPromises);
            
            // 初始化容器映射缓存（如果不存在）
            if (!this.containerMap) {
                this.containerMap = {};
            }
            
            // 更新缓存
            results.forEach((result, index) => {
                const containerId = missingContainerIds[index];
                if (result.status === 'fulfilled' && result.value) {
                    this.containerMap[containerId] = result.value.name || `容器(${containerId})`;
                } else {
                    this.containerMap[containerId] = `容器(${containerId})`;
                }
            });
        }
        
        // 存储所有物料数据
        this.materials = materials;
        // 重置当前页码到第一页
        this.currentPage = 1;
        
        // 渲染当前页的数据和分页控件
        this.renderCurrentPage();
    }
    
    /**
     * 渲染当前页的数据和分页控件
     */
    renderCurrentPage() {
        const container = document.getElementById('materialsTableContainer');
        if (!container) return;
        
        // 计算分页
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentPageMaterials = this.materials.slice(startIndex, endIndex);
        const totalPages = Math.ceil(this.materials.length / this.itemsPerPage);
        
        // 渲染表格
        const tableHtml = `
            <div class="table-container">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>子类别</th>
                            <th>总数量</th>
                            <th>所在位置</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentPageMaterials.map((material, index) => this.createMaterialRow(material, startIndex + index + 1)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // 渲染分页控件
        const paginationHtml = `
            <div class="pagination-container">
                <button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" onclick="app.materialsModule.previousPage()">
                    <i class="fas fa-chevron-left"></i> 上一页
                </button>
                <span class="page-info">第 ${this.currentPage} / ${totalPages} 页</span>
                <button class="pagination-btn ${this.currentPage === totalPages ? 'disabled' : ''}" onclick="app.materialsModule.nextPage()">
                    下一页 <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        
        container.innerHTML = tableHtml + paginationHtml;
    }
    
    /**
     * 上一页
     */
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderCurrentPage();
        }
    }
    
    /**
     * 下一页
     */
    nextPage() {
        const totalPages = Math.ceil(this.materials.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderCurrentPage();
        }
    }

    /**
     * 获取物品所在位置
     * 优化后的查找逻辑，基于用户建议：同时支持storageUnitId和ParentID，并优先使用容器映射缓存
     */
    async getItemLocation(item) {
        // 1. 优先使用物品自带的containerName属性
        if (item.containerName) return item.containerName;

        // 2. 优先使用storageUnitId（主要位置标识）
        if (item.storageUnitId) {
            const storageUnitIdStr = String(item.storageUnitId);
            
            // 优先从预构建的容器映射缓存中查找，效率最高
            if (this.containerMap && this.containerMap[storageUnitIdStr] && this.containerMap[storageUnitIdStr] !== '未知位置') {
                return this.containerMap[storageUnitIdStr];
            }
            
            // 如果缓存中未找到，再尝试从rooms缓存中查找
            let container = findNodeById(StateModule.getCache('rooms'), item.storageUnitId);
            
            // 如果rooms缓存中未找到，则直接在materialAreas中查找
            if (!container) {
                const materialAreas = StateModule.getCache('materialAreas') || [];
                
                // 直接遍历materialAreas数组查找匹配项
                container = materialAreas.find(area => 
                    String(area.id) === storageUnitIdStr || 
                    String(area._id) === storageUnitIdStr
                );
                
                // 如果在顶层没找到，检查是否需要递归查找所有区域下的容器
                if (!container) {
                    // 检查每个区域的子容器
                    for (const area of materialAreas) {
                        if (area.containers) {
                            container = findNodeById([area], item.storageUnitId);
                            if (container) break;
                        }
                    }
                }
            }
            
            // 如果找到了容器，更新缓存以便后续使用
            let locationName;
            if (container) {
                locationName = container.name;
            } else {
                // 如果本地缓存中都未找到，直接从API获取容器信息
                try {
                    const containerInfo = await this.fetchContainerById(storageUnitIdStr);
                    if (containerInfo) {
                        locationName = containerInfo.name || `容器(${storageUnitIdStr})`;
                    } else {
                        locationName = `容器(${storageUnitIdStr})`;
                    }
                } catch (error) {
                    console.error(`获取容器位置时出错 (${storageUnitIdStr}):`, error);
                    locationName = `容器(${storageUnitIdStr})`;
                }
            }
            
            if (!this.containerMap) this.containerMap = {};
            this.containerMap[storageUnitIdStr] = locationName;
            
            return locationName;
        }
        
        // 3. 如果没有storageUnitId但有ParentID（根据用户建议）
        if (item.parentId || item.parentID) {
            const parentId = item.parentId || item.parentID;
            const parentIdStr = String(parentId);
            
            console.log(`使用ParentID获取位置信息: ${parentIdStr}`);
            
            // 尝试从缓存中获取
            if (this.containerMap && this.containerMap[parentIdStr] && this.containerMap[parentIdStr] !== '未知位置') {
                return this.containerMap[parentIdStr];
            }
            
            // 直接从API获取父容器信息
            try {
                const parentInfo = await this.fetchContainerById(parentIdStr);
                if (parentInfo) {
                    const locationName = parentInfo.name || `容器(${parentIdStr})`;
                    
                    // 更新缓存
                    if (!this.containerMap) this.containerMap = {};
                    this.containerMap[parentIdStr] = locationName;
                    
                    return locationName;
                }
            } catch (error) {
                console.error(`获取父容器位置时出错 (${parentIdStr}):`, error);
            }
            
            return `容器(${parentIdStr})`;
        }

        return '未指定';
    }

    /**
     * 创建物料行（支持同步获取位置信息，因为渲染前已预加载）
     */
    createMaterialRow(material, serialNumber) {
        // 收集物料所在的所有位置（使用预加载的容器映射缓存）
        const locations = [...new Set(material.items.map(item => {
            if (item.containerName) return item.containerName;
            
            if (item.storageUnitId) {
                const storageUnitIdStr = String(item.storageUnitId);
                
                // 直接从容器映射缓存获取位置信息
                if (this.containerMap && this.containerMap[storageUnitIdStr]) {
                    return this.containerMap[storageUnitIdStr];
                }
                
                return `容器(${storageUnitIdStr})`;
            }
            
            return '未指定';
        }))];
        
        return `
            <tr>
                <td class="serial-number">${serialNumber}</td>
                <td><strong>${material.subcategory}</strong></td>
                <td>${material.totalQuantity}</td>
                <td>${locations.join('<br>')}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-primary btn-sm" onclick="app.materialsModule.showMaterialDetails('${material.subcategory}')" title="查看详情">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * 显示物料详情
     */
    async showMaterialDetails(subcategory) {
        try {
            console.log('showMaterialDetails called with subcategory:', subcategory);
            
            // 调用后端API获取所有物品
            const allItems = await this.fetchAllItems();
            console.log(`获取到${allItems.length}个物品，准备筛选子类别: ${subcategory}`);
            
            // 筛选出该子类别的所有物品实例
            const materialItems = allItems.filter(item => item.subcategory === subcategory);
            console.log(`筛选后得到${materialItems.length}个该子类别的物品`);
            
            // 显示详情
            const totalInstances = materialItems.length;
            const totalQuantity = materialItems.reduce((total, item) => total + item.quantity, 0);
            console.log(`该子类别的物品数量: ${totalInstances}，总数量: ${totalQuantity}`);
            
            // 预加载所有物品的位置信息
            console.log('开始预加载所有物品的位置信息...');
            const itemsWithLocations = await Promise.all(materialItems.map(async (item) => {
                console.log(`获取物品 ${item._id || item.id} (${item.name}) 的位置信息，storageUnitId: ${item.storageUnitId}, parentId: ${item.parentId || item.parentID}`);
                const locationName = await this.getItemLocation(item);
                console.log(`物品 ${item._id || item.id} 的位置信息: ${locationName}`);
                return { ...item, locationName };
            }));
            console.log('所有物品位置信息预加载完成');
            
            // 准备位置详情
            const locationDetails = itemsWithLocations.reduce((acc, item) => {
                // 使用预加载的位置信息
                const locationName = item.locationName;
                
                if (!acc[locationName]) {
                    acc[locationName] = { quantity: 0, items: [] };
                }
                acc[locationName].quantity += item.quantity;
                acc[locationName].items.push(item);
                return acc;
            }, {});
            
            // 生成模态框内容
            let modalContent = `
                <div class="material-details-container">
                    <div class="material-stats-grid">
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-boxes"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-label">单品数量</div>
                                <div class="stat-value">${totalInstances}</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon">
                                <i class="fas fa-cubes"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-label">总数量</div>
                                <div class="stat-value">${totalQuantity} ${materialItems[0]?.unit || '-'}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="location-distribution-section">
                        <h4><i class="fas fa-map-marker-alt"></i> 各位置分布</h4>
                        <div class="location-cards">
            `;
            
            for (const [location, data] of Object.entries(locationDetails)) {
                modalContent += `
                            <div class="location-card">
                                <div class="location-name">${location}</div>
                                <div class="location-quantity">${data.quantity}</div>
                            </div>
                `;
            }
            
            modalContent += `
                        </div>
                    </div>
                    
                    <div class="all-instances-section">
                        <h4><i class="fas fa-table"></i> 所有单品</h4>
                        <div class="table-container modal-table">
                            <table class="material-instances-table">
                                <thead>
                                    <tr>
                                        <th>序号</th>
                                        <th>物品ID</th>
                                        <th>所在位置</th>
                                        <th>物品名称</th>
                                        <th>数量</th>
                                        <th>单位</th>
                                        <th>规格</th>
                                        <th>状态</th>
                                        <th>过期日期</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            itemsWithLocations.forEach((item, index) => {
                // 使用预加载的位置信息
                const locationName = item.locationName;
                
                // 状态样式
                const statusClass = item.status ? `status-${item.status}` : '';
                
                modalContent += `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item._id || item.id}</td>
                                    <td>${locationName}</td>
                                    <td>${item.name}</td>
                                    <td>${item.quantity}</td>
                                    <td>${item.unit || '-'}</td>
                                    <td>${item.spec || '-'}</td>
                                    <td><span class="status-badge ${statusClass}">${item.status || '-'}</span></td>
                                    <td>${item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '无'}</td>
                                </tr>
                `;
            });
            
            modalContent += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            // 显示模态框
            const modal = document.getElementById('materialDetailsModal');
            const modalBody = document.getElementById('materialDetailsModalBody');
            const modalTitle = document.getElementById('materialDetailsModalTitle');
            const closeBtn = modal.querySelector('.modal-close');
            
            if (modal && modalBody && modalTitle && closeBtn) {
                modalTitle.textContent = `${subcategory}详情`;
                modalBody.innerHTML = modalContent;
                modal.style.display = 'flex';
                
                // 关闭模态框事件
                const closeModal = () => {
                    modal.style.display = 'none';
                };
                
                closeBtn.addEventListener('click', closeModal);
                
                // 点击模态框外部关闭
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        closeModal();
                    }
                });
                
                // 为动态生成的关闭按钮添加事件
                const dynamicCloseBtn = modalBody.querySelector('.modal-close-btn');
                if (dynamicCloseBtn) {
                    dynamicCloseBtn.addEventListener('click', closeModal);
                }
            }
        } catch (error) {
            let errorMessage = '无法显示物料详情，请重试';
            // Check if it's a network error (CORS, connection issues)
            if (error instanceof TypeError) {
                errorMessage = `无法显示物料详情：网络错误或服务器不可达，请检查网络连接和CORS设置。错误详情：${error.message}`;
            }
            console.error('Error showing material details:', error);
            alert(errorMessage);
        }
    }

    /**
     * 搜索物料
     */
    searchMaterials(keyword) {
        keyword = keyword ? keyword.trim() : '';
        if (keyword) {
            // 实现物料搜索功能
            UIHandlersModule.showLoadingState();
            
            // 过滤物料数据 - 同时匹配子类别和物品名称
            const filteredMaterials = this.materials.filter(material =>
                material.subcategory.toLowerCase().includes(keyword.toLowerCase()) ||
                material.items.some(item =>
                    item.name.toLowerCase().includes(keyword.toLowerCase())
                )
            );
            
            // 搜索时重置页码
            this.currentPage = 1;
            
            // 渲染搜索结果
            this.renderSearchResults(filteredMaterials);
            
            UIHandlersModule.hideLoadingState();
        } else {
            // 如果搜索关键词为空，重新加载所有物料
            this.loadMaterialsByCategory();
        }
    }
    
    /**
     * 渲染搜索结果
     */
    renderSearchResults(materials) {
        const container = document.getElementById('materialsTableContainer');
        if (!container) return;
        
        if (materials.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search fa-3x"></i>
                    <p>没有找到匹配的物料</p>
                </div>
            `;
            return;
        }
        
        // 计算分页
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const currentPageMaterials = materials.slice(startIndex, endIndex);
        const totalPages = Math.ceil(materials.length / this.itemsPerPage);
        
        // 渲染表格
        const tableHtml = `
            <div class="table-container">
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>子类别</th>
                            <th>总数量</th>
                            <th>所在位置</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${currentPageMaterials.map((material, index) => this.createMaterialRow(material, startIndex + index + 1)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        // 渲染分页控件
        const paginationHtml = `
            <div class="pagination-container">
                <button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" onclick="app.materialsModule.previousPage()">
                    <i class="fas fa-chevron-left"></i> 上一页
                </button>
                <span class="page-info">第 ${this.currentPage} / ${totalPages} 页</span>
                <button class="pagination-btn ${this.currentPage === totalPages ? 'disabled' : ''}" onclick="app.materialsModule.nextPage()">
                    下一页 <i class="fas fa-chevron-right"></i>
                </button>
            </div>
        `;
        
        container.innerHTML = tableHtml + paginationHtml;
    }
}

export { MaterialsModule };