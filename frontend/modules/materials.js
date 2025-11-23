import { loadMaterialsByCategory } from './data.js';
import { findNodeById, getContainerPathById } from './utils.js';
import StateModule from './state.js';
import eventBus from './eventBus.js';
import { loadItemStatusConfig } from './data.js';
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
    /**
     * 通过容器名称查找容器对象
     * @param {Array} nodes - 节点数组
     * @param {string} containerName - 容器名称
     * @returns {Object|null} - 找到的容器对象或null
     */
    findContainerByName(nodes, containerName) {
        if (!nodes || !Array.isArray(nodes)) {
            return null;
        }
        
        for (const node of nodes) {
            // 检查当前节点的名称是否匹配
            if (node.name === containerName) {
                return node;
            }
            
            // 递归搜索子容器
            if (node.containers && node.containers.length > 0) {
                const found = this.findContainerByName(node.containers, containerName);
                if (found) return found;
            }
        }
        return null;
    }
    
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
     * 优化后的查找逻辑：通过物品的storageUnitId获取容器信息，确保返回完整的容器层级路径
     * 使用getContainerPathById获取完整路径如"玄关-鞋柜"
     */
    async getItemLocation(item) {
        // 添加详细调试日志
        const startTime = Date.now();
        const itemId = item._id || item.id;
        const itemName = item.name || '未知名称';
        console.log(`[位置获取开始] 物品ID: ${itemId}, 名称: ${itemName}`);
        console.log(`[物品信息] storageUnitId: ${item.storageUnitId}, containerName: ${item.containerName}`);
        
        try {
            // 1. 优先使用storageUnitId（主要位置标识）
            if (item.storageUnitId) {
                const storageUnitIdStr = String(item.storageUnitId);
                console.log(`[Step 1] 开始处理storageUnitId: ${storageUnitIdStr}`);
                
                // 打印当前容器映射缓存状态
                if (this.containerMap) {
                    const cacheKeys = Object.keys(this.containerMap);
                    console.log(`[调试] 当前容器映射缓存包含 ${cacheKeys.length} 项`);
                    if (cacheKeys.includes(storageUnitIdStr)) {
                        console.log(`[调试] 当前storageUnitId已存在于缓存中: ${this.containerMap[storageUnitIdStr]}`);
                    }
                }
                
                // 优先从预构建的容器映射缓存中查找，效率最高
                if (this.containerMap && this.containerMap[storageUnitIdStr] && this.containerMap[storageUnitIdStr] !== '未知位置') {
                    const cachedPath = this.containerMap[storageUnitIdStr];
                    console.log(`[缓存命中] 从容器映射缓存中获取到路径: ${cachedPath}`);
                    return cachedPath;
                }
                
                const rooms = StateModule.getCache('rooms');
                console.log(`[数据源] rooms缓存是否可用: ${rooms ? '是' : '否'}`);
                
                // 优先尝试获取完整路径 - 核心逻辑：使用getContainerPathById获取完整容器路径
                if (rooms) {
                    console.log(`[Step 2] 尝试使用getContainerPathById获取完整路径`);
                    try {
                        const fullPath = getContainerPathById(rooms, item.storageUnitId, rooms);
                        console.log(`[路径构建] getContainerPathById返回: ${fullPath || 'null'}`);
                        
                        if (fullPath) {
                            // 更新缓存，确保缓存中存储的是完整路径
                            if (!this.containerMap) this.containerMap = {};
                            this.containerMap[storageUnitIdStr] = fullPath;
                            console.log(`[成功] 获取到物品的完整路径: ${fullPath}，已缓存`);
                            return fullPath;
                        }
                    } catch (pathError) {
                        console.error(`[错误] getContainerPathById执行出错:`, pathError);
                    }
                }
                
                // 如果直接获取完整路径失败，尝试获取容器对象并再次尝试构建路径
                let container;
                console.log(`[Step 3] 尝试获取容器对象`);
                
                // 1. 从rooms缓存中查找容器
                if (rooms) {
                    console.log(`[查找容器] 尝试从rooms缓存中查找`);
                    container = findNodeById(rooms, item.storageUnitId);
                    console.log(`[查找结果] rooms中查找结果: ${container ? '找到容器' : '未找到'}`);
                }
                
                // 2. 如果rooms缓存中未找到，从materialAreas中查找
                if (!container) {
                    console.log(`[查找容器] 尝试从materialAreas中查找`);
                    const materialAreas = StateModule.getCache('materialAreas') || [];
                    console.log(`[数据源] materialAreas长度: ${materialAreas.length}`);
                    
                    // 直接遍历materialAreas数组查找匹配项
                    container = materialAreas.find(area => 
                        String(area.id) === storageUnitIdStr || 
                        String(area._id) === storageUnitIdStr
                    );
                    console.log(`[查找结果] materialAreas顶层查找结果: ${container ? '找到容器' : '未找到'}`);
                    
                    // 如果在顶层没找到，检查是否需要递归查找所有区域下的容器
                    if (!container) {
                        console.log(`[查找容器] 尝试从materialAreas的子容器中查找`);
                        // 检查每个区域的子容器
                        for (const area of materialAreas) {
                            if (area.containers) {
                                container = findNodeById([area], item.storageUnitId);
                                if (container) {
                                    console.log(`[查找结果] 在区域子容器中找到匹配项`);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                // 3. 如果本地缓存中都未找到，直接从API获取容器信息
                if (!container) {
                    console.log(`[Step 4] 尝试从API获取容器信息`);
                    try {
                        console.log(`[API请求] 获取容器ID: ${storageUnitIdStr} 的信息`);
                        const containerInfo = await this.fetchContainerById(storageUnitIdStr);
                        if (containerInfo) {
                            container = containerInfo;
                            console.log(`[API成功] 获取到容器信息: ${container.name}`);
                        } else {
                            console.log(`[API失败] 未获取到容器信息`);
                        }
                    } catch (error) {
                        console.error(`[API错误] 获取容器位置时出错 (${storageUnitIdStr}):`, error);
                    }
                }
                
                // 处理容器信息，优先尝试构建完整路径
                let locationName;
                if (container) {
                    console.log(`[Step 5] 处理容器信息，容器名称: ${container.name || '无名称'}`);
                    // 关键点：即使找到了容器，也要再次尝试构建完整路径
                    if (rooms && container.id) {
                        console.log(`[再次尝试] 使用容器ID(${container.id})再次尝试构建完整路径`);
                        try {
                            const fullPath = getContainerPathById(rooms, container.id, rooms);
                            if (fullPath) {
                                locationName = fullPath;
                                console.log(`[成功] 通过容器对象重建完整路径: ${fullPath}`);
                            } else {
                                // 如果仍无法构建完整路径，使用容器名称，并尝试通过parentId递归构建
                                console.log(`[降级] 无法构建完整路径，尝试parentId降级方案`);
                                locationName = container.name || '未命名容器';
                                if (rooms && container.parentId) {
                                    console.log(`[处理父容器] 当前容器: ${container.name}, parentId: ${container.parentId}`);
                                    // 获取父容器信息
                                    const parentContainer = findNodeById(rooms, container.parentId);
                                    if (parentContainer) {
                                        // 简单拼接父容器名和当前容器名
                                        locationName = `${parentContainer.name}-${container.name}`;
                                        console.log(`[成功] 简单拼接的路径: ${locationName}`);
                                    } else {
                                        console.log(`[警告] 找不到父容器ID: ${container.parentId}`);
                                    }
                                }
                            }
                        } catch (pathError) {
                            console.error(`[错误] 再次尝试构建路径时出错:`, pathError);
                            locationName = container.name || '未命名容器';
                        }
                    } else {
                        console.log(`[默认] 使用容器名称作为位置`);
                        locationName = container.name || `容器(${storageUnitIdStr})`;
                    }
                } else {
                    console.log(`[默认] 未找到容器，使用容器ID作为位置`);
                    locationName = `容器(${storageUnitIdStr})`;
                }
                
                // 更新缓存
                console.log(`[缓存更新] 保存位置信息到缓存: ${locationName}`);
                if (!this.containerMap) this.containerMap = {};
                this.containerMap[storageUnitIdStr] = locationName;
                
                return locationName;
            }
            
            // 2. 如果有containerName但没有storageUnitId，尝试从rooms数据中查找完整路径
            if (item.containerName) {
                const containerName = String(item.containerName);
                console.log(`[Step 6] 处理containerName: ${containerName}`);
                
                // 尝试从rooms数据中查找匹配的容器名，获取其完整路径
                const rooms = StateModule.getCache('rooms');
                console.log(`[数据源] rooms缓存是否可用: ${rooms ? '是' : '否'}`);
                
                if (rooms) {
                    console.log(`[查找容器] 通过名称在rooms中查找容器`);
                    // 先尝试通过物品的containerName查找对应的容器对象
                    const container = this.findContainerByName(rooms, containerName);
                    console.log(`[查找结果] 找到匹配容器: ${container ? '是' : '否'}`);
                    
                    if (container && container.id) {
                        console.log(`[Step 7] 找到容器ID: ${container.id}，尝试构建完整路径`);
                        try {
                            const fullPath = getContainerPathById(rooms, container.id, rooms);
                            console.log(`[路径构建] 通过容器ID构建的路径: ${fullPath || 'null'}`);
                            
                            if (fullPath) {
                                return fullPath;
                            } else if (container.parentId) {
                                // 退而求其次：如果找不到完整路径但有parentId，尝试简单拼接
                                console.log(`[降级] 尝试通过parentId(${container.parentId})拼接路径`);
                                const parentContainer = findNodeById(rooms, container.parentId);
                                if (parentContainer) {
                                    const combinedPath = `${parentContainer.name}-${container.name}`;
                                    console.log(`[成功] 拼接得到路径: ${combinedPath}`);
                                    return combinedPath;
                                }
                            }
                        } catch (pathError) {
                            console.error(`[错误] 通过containerName构建路径时出错:`, pathError);
                        }
                    }
                }
                
                // 降级：如果找不到完整路径，返回containerName
                console.log(`[降级] 未找到完整路径，直接返回containerName: ${containerName}`);
                return containerName;
            }
            
            // 3. 最后返回默认值
            console.log(`[默认] 物品没有位置信息，返回'未知位置'`);
            return '未知位置';
        } catch (error) {
            console.error(`[严重错误] 获取物品位置信息时发生异常:`, error);
            return '未知位置';
        } finally {
            const endTime = Date.now();
            console.log(`[位置获取结束] 物品ID: ${itemId}, 处理时间: ${endTime - startTime}ms`);
        }
    }

    /**
     * 创建物料行（支持同步获取位置信息，因为渲染前已预加载）
     */
    createMaterialRow(material, serialNumber) {
        // 收集物料所在的所有位置（使用预加载的容器映射缓存）
        const locations = [...new Set(material.items.map(item => {
            // 优先使用容器映射缓存中的位置信息
            if (item.storageUnitId) {
                const storageUnitIdStr = String(item.storageUnitId);
                
                // 直接从容器映射缓存获取位置信息（预加载的完整路径）
                if (this.containerMap && this.containerMap[storageUnitIdStr]) {
                    return this.containerMap[storageUnitIdStr];
                }
                
                return `容器(${storageUnitIdStr})`;
            }
            
            // 如果有containerName但没有storageUnitId，使用容器名
            if (item.containerName) return item.containerName;
            
            return '未知位置';
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
            
            // 获取物品状态配置信息
            // 从后端API获取itemStatusConfig数据
            console.log('从后端API获取物品状态配置信息...');
            const itemStatusConfig = await loadItemStatusConfig(this.apiBaseUrl);
            console.log(`成功获取${itemStatusConfig.length}条物品状态配置信息`);
                        
            // 预加载所有物品的位置信息 - 优化版本
            console.log('开始预加载所有物品的位置信息...');
            
            // 为了确保获取最新的位置路径，可以选择性地清除或重建容器映射缓存
            // 如果缓存可能过时，可以考虑清除它
            // this.containerMap = {}; // 可选：清除缓存以获取最新数据
            
            // 获取所有唯一的storageUnitId，用于批量预加载容器信息
            const uniqueStorageUnitIds = new Set();
            materialItems.forEach(item => {
                if (item.storageUnitId) {
                    uniqueStorageUnitIds.add(String(item.storageUnitId));
                }
            });
            console.log(`发现${uniqueStorageUnitIds.size}个不同的容器ID需要预加载`);
            
            // 预加载容器信息到缓存中 - 这可以提高单个物品查询的性能
            const rooms = StateModule.getCache('rooms');
            if (rooms) {
                console.log('使用rooms缓存预构建容器映射');
                this.buildContainerMapFromNodes(rooms, uniqueStorageUnitIds);
            }
            
            // 为每个物品获取位置信息
            const itemsWithLocations = await Promise.all(materialItems.map(async (item) => {
                const itemId = item._id || item.id;
                const storageUnitId = item.storageUnitId;
                console.log(`获取物品 ${itemId} (${item.name}) 的位置信息，storageUnitId: ${storageUnitId}`);
                
                // 强制使用我们优化过的getItemLocation方法，确保获取完整路径
                const locationName = await this.getItemLocation(item);
                
                // 特别检查路径是否包含层级信息（包含'-'）
                if (locationName && !locationName.includes('-') && storageUnitId) {
                    console.log(`物品 ${itemId} 只返回了单层位置: ${locationName}，尝试直接构建完整路径`);
                    // 尝试直接使用storageUnitId和getContainerPathById构建完整路径
                    if (rooms) {
                        const fullPath = getContainerPathById(rooms, storageUnitId, rooms);
                        if (fullPath) {
                            console.log(`成功为物品 ${itemId} 构建完整路径: ${fullPath}`);
                            return { ...item, locationName: fullPath };
                        }
                    }
                }
                
                console.log(`物品 ${itemId} 的最终位置信息: ${locationName}`);
                return { ...item, locationName };
            }));
            
            console.log('所有物品位置信息预加载完成，共处理了', itemsWithLocations.length, '个物品');
            
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
                    
                    <div class="all-instances-section">
                        <h4><i class="fas fa-list"></i> 所有单品</h4>
                        <div class="list-container modal-list full-width">
                            <ul class="material-instances-list">
            `;
            
            itemsWithLocations.forEach((item, index) => {
                // 使用预加载的位置信息
                const locationName = item.locationName;
                
                // 获取规格信息，尝试从多个可能的字段获取
                // 构建更完整的规格信息，将多个可能的规格字段组合
                let specInfo = '-';
                let specs = [];
                
                // 收集所有可能的规格信息字段
                if (item.spec) specs.push(item.spec);
                if (item.specification && item.specification !== item.spec) specs.push(item.specification);
                if (item.size && !specs.includes(item.size)) specs.push(item.size);
                if (item.model && !specs.includes(item.model)) specs.push(item.model);
                if (item.details && !specs.includes(item.details)) specs.push(item.details);
                
                // 如果有规格信息，用逗号连接
                if (specs.length > 0) {
                    specInfo = specs.join('，');
                }
                // 如果没有收集到规格信息，可以尝试从其他可能的字段获取
                else if (item.brand && item.brand !== item.name) {
                    // 可以显示品牌信息作为规格的补充
                    specInfo = `${item.brand}`;
                }
                
                // 状态样式和显示逻辑 - 使用小圆形图标
                let statusClass = 'status-none';
                if (item.status) {
                    switch(item.status.toLowerCase()) {
                        case 'good':
                        case '正常':
                        case 'normal':
                            statusClass = 'status-good';
                            break;
                        case 'warning':
                        case '警告':
                            statusClass = 'status-warning';
                            break;
                        case 'error':
                        case '错误':
                        case 'expired':
                        case '过期':
                            statusClass = 'status-error';
                            break;
                        default:
                            statusClass = 'status-info';
                    }
                }
                
                // 过期信息处理和底色样式
                let expiryClass = 'expiry-normal'; // 默认绿色
                let expiryText = '无';
                
                // 获取物品ID
                const itemId = item._id || item.id;
                
                // 直接在itemStatusConfig数据集合中按物品ID查找信息
                let statusConfig = null;
                
                if (itemStatusConfig && Array.isArray(itemStatusConfig)) {
                    statusConfig = itemStatusConfig.find(config => config._id === itemId);
                }
                
                // 根据查找结果设置过期日期显示
                if (!statusConfig || !statusConfig.expiryDate) {
                    // 如果没有信息，或者有信息但没有expiryDate字段，则显示为"无"
                    expiryText = '无';
                } else {
                    // 如果expiryDate字段有信息，则显示过期日期
                    try {
                        expiryText = new Date(statusConfig.expiryDate).toLocaleDateString('zh-CN');
                        
                        // 计算样式类（保持原有逻辑以显示不同颜色）
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const itemExpiryDate = new Date(statusConfig.expiryDate);
                        itemExpiryDate.setHours(0, 0, 0, 0);
                        
                        const expiryWarningDays = parseInt(statusConfig.expiryWarning) || 30;
                        const warningDate = new Date(itemExpiryDate);
                        warningDate.setDate(warningDate.getDate() - expiryWarningDays);
                        warningDate.setHours(0, 0, 0, 0);
                        
                        if (today < warningDate) {
                            expiryClass = 'expiry-normal'; // 绿色
                        } else if (today >= warningDate && today <= itemExpiryDate) {
                            expiryClass = 'expiry-low'; // 黄色
                        } else {
                            expiryClass = 'expiry-expired'; // 红色
                        }
                    } catch (e) {
                        // 日期解析出错时显示为"无"
                        expiryText = '无';
                    }
                }
                
                modalContent += `
                                <li class="material-instance-item">
                                    <div class="item-header">
                                        <span class="item-number">#${index + 1}</span>
                                        <span class="status-circle ${statusClass}" title="${item.status || '无状态'}"></span>
                                    </div>
                                    <div class="item-content">
                                        <h5>${item.name}</h5>
                                        <div class="item-details">
                                            <div class="detail-row">
                                                <span class="detail-label">物品ID:</span>
                                                <span class="detail-value">${item._id || item.id}</span>
                                            </div>
                                            <div class="detail-row">
                                                <span class="detail-label">所在位置:</span>
                                                <span class="detail-value">${locationName}</span>
                                            </div>
                                            <div class="detail-row">
                                                <span class="detail-label">数量:</span>
                                                <span class="detail-value">${item.quantity} ${item.unit || '-'}</span>
                                            </div>
                                            <div class="detail-row">
                                                <span class="detail-label">规格:</span>
                                                <span class="detail-value spec-detail">${specInfo}</span>
                                            </div>
                                            <div class="detail-row expiry-row">
                                                <span class="detail-label">过期日期:</span>
                                                <span class="detail-value ${expiryClass}">${expiryText}</span>
                                            </div>
                                        </div>
                                    </div>
                                </li>
                `;
            });
            
            modalContent += `
                            </ul>
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