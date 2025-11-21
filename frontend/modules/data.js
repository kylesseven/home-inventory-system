// 数据层模块，处理所有数据相关操作

// 导入工具函数
import eventBus from './eventBus.js';
// 删除未使用的导入

/**
 * 将扁平的容器数组转换为嵌套结构
 * @param {Array} flatContainers - 扁平的容器数组
 * @returns {Array} 嵌套的容器数组
 */
function nestContainers(flatContainers) {
    // 如果没有容器，直接返回
    if (!flatContainers || flatContainers.length === 0) {
        return [];
    }
    
    // 创建容器映射
    const containerMap = new Map();
    
    // 遍历所有容器，创建映射并初始化子容器数组为清空状态
    flatContainers.forEach(container => {
        containerMap.set(container.id, {
            ...container,
            containers: []
        });
    });
    
    // 遍历所有容器，将它们添加到父容器的子容器数组中
    const topLevelContainers = [];
    flatContainers.forEach(container => {
        const currentContainer = containerMap.get(container.id);
        
        if (container.parentId) {
            const parentContainer = containerMap.get(container.parentId);
            if (parentContainer) {
                parentContainer.containers.push(currentContainer);
            } else {
                // 父容器不存在，作为顶级容器处理
                topLevelContainers.push(currentContainer);
            }
        } else if (container.areaId) {
            // 没有parentId但有areaId，作为该区域（房间）的子容器处理
            const areaContainer = containerMap.get(container.areaId);
            if (areaContainer) {
                areaContainer.containers.push(currentContainer);
            } else {
                // 区域不存在，作为顶级容器处理
                topLevelContainers.push(currentContainer);
            }
        } else {
            // 没有parentId和areaId，作为顶级容器处理
            topLevelContainers.push(currentContainer);
        }
    });
    
    return topLevelContainers;
}

/**
 * 加载所有房间数据
 * @param {string} apiBase - API基础URL
 * @returns {Promise<Object>} 包含roomsData、currentRoomData和rooms的对象
 */
export async function loadRooms(apiBase = '/api') {
    try {
        // const response = await fetch(`${apiBase}/storage_units?type=room`);
        const response = await fetch(`${apiBase}/areas`);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP错误: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // 保存所有数据
            const roomsData = result.data;
            // 过滤出房间类型的数据
            const rooms = Array.isArray(roomsData) ? roomsData.filter(unit => unit.type === 'room') : [];
            
            // 递归处理容器，确保所有容器都有id字段
            const processContainer = (container, parent) => {
                const processedContainer = {
                    ...container,
                    id: container._id || container.id,
                    parentNode: parent
                };
                
                // 处理嵌套容器
                if (processedContainer.containers) {
                    processedContainer.containers = processedContainer.containers.map(child => processContainer(child, processedContainer));
                }
                
                return processedContainer;
            };
            
            // 处理所有房间和它们的嵌套容器
            const processedRooms = rooms.map(room => processContainer(room, null));
            
            return { roomsData, currentRoomData: processedRooms, rooms: processedRooms };
        } else {
            throw new Error(result.message || '未知错误');
        }
    } catch (error) {
        if (error.message.includes('net::ERR_ABORTED')) {
            console.warn('[DEBUG] loadRooms - 请求被中断(net::ERR_ABORTED)，这通常是正常的页面导航行为');
            return { roomsData: [], currentRoomData: [], rooms: [] };
        }
        return { roomsData: [], currentRoomData: [], rooms: [] };
    }
}

/**
 * 获取仪表盘统计数据
 * @param {string} API_BASE - API基础URL
 * @returns {Object} 仪表盘统计数据对象
 */
export async function loadDashboardDataFromAPI(API_BASE) {
    try {
        // 获取物品总数和物品种类数
        const totalItemsResponse = await fetch(`${API_BASE}/items`);
        let categoryCount = 0;
        let totalItemsCount = 0;
        if (totalItemsResponse.ok) {
            const totalItemsResult = await totalItemsResponse.json();
            if (totalItemsResult.success) {
                // 从API响应获取物品种类总数，如果没有则自行计算
                categoryCount = totalItemsResult.categoryCount || 0;
                if (Array.isArray(totalItemsResult.data)) {
                    totalItemsCount = totalItemsResult.data.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
                    // 如果API未返回categoryCount或返回0，则自行计算
                    if (categoryCount === 0) {
                        const uniqueSubcategories = new Set();
                        totalItemsResult.data.forEach(item => {
                            if (item.subcategory) {
                                uniqueSubcategories.add(item.subcategory);
                            }
                        });
                        categoryCount = uniqueSubcategories.size;
                    }
                }
            }
        }
        
        // 获取库存预警物品数量（数量小于itemStatusConfig中对应物品的stockAlert字段值）
        let lowInventoryCount = 0;
        try {
            // 首先获取所有物品数据
            const itemsResponse = await fetch(`${API_BASE}/items`);
            if (itemsResponse.ok) {
                const itemsResult = await itemsResponse.json();
                if (itemsResult.success && Array.isArray(itemsResult.data)) {
                    // 加载物品状态配置
                    const itemStatusConfig = await loadItemStatusConfig(API_BASE);
                    // 创建配置映射，便于快速查找
                    const configMap = new Map();
                    if (Array.isArray(itemStatusConfig)) {
                        itemStatusConfig.forEach(config => {
                            if (config._id) {
                                configMap.set(config._id, config);
                            }
                        });
                    }
                    
                    // 统计库存预警物品数量
                    itemsResult.data.forEach(item => {
                        const itemQuantity = parseInt(item.quantity) || 0;
                        // 查找对应物品的配置
                        const config = configMap.get(item._id);
                        if (config && config.stockAlert) {
                            const alertThreshold = parseInt(config.stockAlert) || 0;
                            // 如果物品数量小于预警阈值，则计入预警
                            if (itemQuantity < alertThreshold) {
                                lowInventoryCount++;
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error calculating low inventory items:', error);
            // 如果出错，使用备用逻辑（数量≤10）
            const fallbackResponse = await fetch(`${API_BASE}/items/search?maxQuantity=10`);
            if (fallbackResponse.ok) {
                const fallbackResult = await fallbackResponse.json();
                lowInventoryCount = fallbackResult.success ? (fallbackResult.count || 0) : 0;
            }
        }
        
        // 获取今日入库数量 (toISOString()自动转换为UTC时间)
        const now = new Date();

        // 直接创建本地当日开始和结束时间并转换为UTC ISO字符串
        const startOfDayUTC = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        const endOfDayUTC = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
        const todayInResponse = await fetch(`${API_BASE}/inventory?startDate=${startOfDayUTC}&endDate=${endOfDayUTC}&type=in`);

        let todayInCount = 0;
        if (todayInResponse.ok) {
            const todayInResult = await todayInResponse.json();
            if (todayInResult.success && Array.isArray(todayInResult.data)) {
                // 入库时变化量为 newValue - oldValue
                todayInCount = todayInResult.data.reduce((sum, record) => 
                    sum + (parseInt(record.newValue) - parseInt(record.oldValue)), 0);
            }
        }
        
        // 获取今日出库数量 (基于用户本地时间)
        const todayOutResponse = await fetch(`${API_BASE}/inventory?startDate=${startOfDayUTC}&endDate=${endOfDayUTC}&type=out`);
        let todayOutCount = 0;
        if (todayOutResponse.ok) {
            const todayOutResult = await todayOutResponse.json();
            if (todayOutResult.success && Array.isArray(todayOutResult.data)) {
                // 出库时变化量为 oldValue - newValue
                todayOutCount = todayOutResult.data.reduce((sum, record) => 
                    sum + (parseInt(record.oldValue) - parseInt(record.newValue)), 0);
            }
        }
        
        // 获取房间总数和容器总数
        const rooms = await loadAreas(API_BASE);
        const totalRooms = rooms.length;
        const totalContainers = await getContainerCount(API_BASE);
        
        const dashboardData = {
            categoryCount,
            lowInventoryCount,
            todayInCount,
            todayOutCount,
            totalRooms,
            totalContainers,
            totalItemsCount
        };

        // 发布数据更新事件
        eventBus.publish('data-updated', dashboardData);

        return dashboardData;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        return {
            categoryCount: 0,
            totalItems: 0,
            lowInventoryCount: 0,
            todayInCount: 0,
            todayOutCount: 0,
            totalRooms: 0,
            totalContainers: 0,
            totalItemsCount: 0
        };
    }
}

/**
 * 根据ID查找物品
 * @param {Array} nodes - 节点数组（房间或容器）
 * @param {string} itemId - 物品ID
 * @returns {Object|null} 找到的物品对象或null
 */
export function findItemById(nodes, itemId) {
    for (const node of nodes) {
        // 检查当前节点的物品
        if (node.items) {
            const item = node.items.find(i => i.id === itemId);
            if (item) return item;
        }

        // 递归检查子节点 - 只处理containers字段（新的数据结构）
        if (node.containers && node.containers.length > 0) {
            const found = findItemById(node.containers, itemId);
            if (found) return found;
        }
    }
    return null;
}

/**
 * 查找物品所在的容器
 * @param {Array} nodes - 节点数组（房间或容器）
 * @param {string} itemId - 物品ID
 * @param {Array} path - 当前路径（用于递归）
 * @returns {Object|null} 包含容器信息和路径的对象或null
 */
export function findItemContainer(nodes, itemId, path = []) {
    for (const node of nodes) {
        const currentPath = [...path, node.name];

        // 检查当前节点的物品
        if (node.items && node.items.find(i => i.id === itemId)) {
            return {
                container: node,
                containerName: node.name,
                path: currentPath.join(' → ')
            };
        }

        // 递归检查子节点 - 只处理containers字段（新的数据结构）
        if (node.containers && node.containers.length > 0) {
            const found = findItemContainer(node.containers, itemId, currentPath);
            if (found) return found;
        }
    }
    return null;
}

/**
 * 加载所有区域数据
 * @returns {Promise<Array>} 区域数据数组
 */
export async function loadAreas(apiBase) {
    try {
        const response = await fetch(`${apiBase}/areas`);
        if (!response.ok) {
            throw new Error('Failed to load areas');
        }
        const result = await response.json();
        return result.data || [];
    } catch (error) {
        console.error('Error loading areas:', error);
        return [];
    }
}

/**
 * 加载所有物品数据
 * @returns {Promise<Array>} 物品数据数组
 */
export async function loadItems(apiBase) {
    try {
        const response = await fetch(`${apiBase}/items`);
        if (!response.ok) {
            throw new Error('Failed to load items');
        }
        const result = await response.json();
        return result.data || [];
    } catch (error) {
        console.error('Error loading items:', error);
        return [];
    }
}

/**
 * 获取容器总数（通过API直接获取后端计算的数量）
 * @returns {Promise<number>} 容器总数
 */
export async function getContainerCount(API_BASE) {
    try {
        const containersResponse = await fetch(`${API_BASE}/storage_units`);
        if (containersResponse.ok) {
            const containersResult = await containersResponse.json();
            if (containersResult.success) {
                return containersResult.count || 0; // 使用后端返回的直接数量，默认0
            }
        }
        return 0;
    } catch (error) {
        console.error('Error getting container count:', error);
        return 0;
    }
}

/**
 * 加载存储数据
 * @returns {Promise<Object>} 包含rooms和items的对象
 */
export async function getStorageData(API_BASE) {
    try {
        console.log('API_BASE:', API_BASE);
        // 并行加载区域、存储单元和物品数据
        const [areas, storageUnitsResponse, items] = await Promise.all([
            loadAreas(API_BASE),
            fetch(`${API_BASE}/storage_units`),
            loadItems(API_BASE)
        ]);

        // 处理存储单元响应
        const storageUnitsResult = await storageUnitsResponse.json();
        const storageUnits = storageUnitsResult.success ? storageUnitsResult.data : [];
        
        // 合并房间和存储单元为扁平数组，并确保所有单元有正确的ID
        const allFlatUnits = [
            ...areas.map(area => ({
                ...area,
                id: area._id || area.id
            })),
            ...storageUnits.map(unit => ({
                ...unit,
                id: unit._id || unit.id
            }))
        ];

        // 使用nestContainers函数将扁平结构转换为嵌套结构
        const rooms = nestContainers(allFlatUnits);
        
        // 6. 将物品附加到对应的容器
        console.log('Attaching items to containers:', items.length);
        let attachedCount = 0;
        let notFoundCount = 0;
        let duplicateCount = 0;
        
        // 创建一个包含所有容器的扁平化数组，用于快速查找
        const allContainers = [];
        const addAllContainers = (containers) => {
            containers.forEach(container => {
                allContainers.push(container);
                if (container.containers && container.containers.length > 0) {
                    addAllContainers(container.containers);
                }
            });
        };
        // 将所有房间和容器添加到allContainers数组中
        allContainers.push(...rooms);
        rooms.forEach(room => {
            if (room.containers && room.containers.length > 0) {
                addAllContainers(room.containers);
            }
        });
        
        const allContainersMap = new Map();
        // 将所有类型的存储单元（包括房间）添加到allContainersMap中
        allContainers.forEach(container => {
            if (container.id) {
                allContainersMap.set(container.id, container);
            }
        });
        
        items.forEach(item => {
            const storageUnitId = item.storageUnitId;
            
            // 快速查找容器
            const container = allContainersMap.get(storageUnitId);
            
            if (container) {
                // 如果容器没有items数组，创建一个
                if (!container.items) {
                    container.items = [];
                }
                // 检查物品是否已经存在于容器中，避免重复添加
                const itemExists = container.items.some(existingItem => 
                    existingItem.id === item.id || existingItem._id === item._id
                );
                if (!itemExists) {
                    container.items.push(item);
                    attachedCount++;
                } else {
                    duplicateCount++;
                }
            } else {
                notFoundCount++;
            }
        });
        
        console.log('Items attached:', attachedCount, 'Items not found:', notFoundCount, 'Duplicate items skipped:', duplicateCount);
        
        return { rooms, items };
    } catch (error) {
        console.error('Error loading storage data:', error);
        return { rooms: [], items: [] };
    }
}

/**
 * 加载物料分类数据
 * @returns {Promise<Array>} 物料分类数据数组
 */
export async function loadMaterialsByCategory(apiBase) {
    try {
        const areas = await loadAreas(apiBase);
        const items = await loadItems(apiBase);
        
        // 按子类别合并物品并统计数量
        const materialMap = items.reduce((map, item) => {
            const key = item.subcategory || '未分类';
            if (!map[key]) {
                map[key] = { items: [], total: 0 };
            }
            map[key].items.push(item);
            map[key].total += item.quantity;
            return map;
        }, {});
        
        // 转换为数组格式
        const materials = Object.entries(materialMap).map(([subcategory, data]) => ({
            subcategory,
            items: data.items,
            total: data.total
        }));
        
        // 按子类别名称排序
        materials.sort((a, b) => a.subcategory.localeCompare(b.subcategory, 'zh-CN'));
        
        return materials;
    } catch (error) {
        console.error('Error loading materials by category:', error);
        return [];
    }
}

/**
 * 删除物品
 * @param {string} API_BASE - API基础URL
 * @param {string} itemId - 物品ID
 * @returns {Promise<Object>} 包含success和message的结果对象
 */
export async function deleteItem(API_BASE, itemId) {
    try {
        const response = await fetch(`${API_BASE}/items/${itemId}`, {
            method: 'DELETE'
        });
        return await response.json();
    } catch (error) {
        console.error('Error deleting item:', error);
        return { success: false, message: error.message };
    }
}

/**
 * 更新物品数量
 * @param {string} API_BASE - API基础URL
 * @param {string} itemId - 物品ID
 * @param {number} newQuantity - 新的数量
 * @returns {Promise<Object>} 包含success和message的结果对象
 */
export async function updateItemQuantity(API_BASE, itemId, newQuantity) {
    try {
        const response = await fetch(`${API_BASE}/items/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                quantity: newQuantity
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating item quantity:', error);
        return { success: false, message: error.message };
    }
}

/**
 * 搜索物品
 * @param {string} API_BASE - API基础URL
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Object>} 包含success和data的结果对象
 */
export async function searchItems(API_BASE, keyword) {
    try {
        const response = await fetch(`${API_BASE}/items/search?keyword=${encodeURIComponent(keyword)}`);
        return await response.json();
    } catch (error) {
        console.error('Error searching items:', error);
        return { success: false, message: error.message };
    }
}

/**
 * 加载物品状态配置数据
 * @param {string} API_BASE - API基础URL
 * @returns {Promise<Array>} 物品状态配置数据数组
 */
export async function loadItemStatusConfig(API_BASE) {
    try {
        const response = await fetch(`${API_BASE}/inventory/status-config`);
        const result = await response.json();
        // 检查结果是否成功，然后返回数据数组
        return result.success ? result.data : [];
    } catch (error) {
        console.error('Error loading item status config:', error);
        return [];
    }
}