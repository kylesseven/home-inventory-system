// 节点类型检查工具
/**
 * 检查节点是否为房间类型
 */
export function isRoomNode(node) {
    return node.type === 'room';
}

/**
 * 检查节点是否为容器类型
 */
export function isContainerNode(node) {
    if (isRoomNode(node)) return false;
    return (node.id || node._id) && (node.areaId || node.parentId);
}

// 节点遍历与搜索工具
/**
 * 收集指定节点下的所有物品
 */
export function collectAllItems(node) {
    const itemsMap = new Map(); // 使用Map来存储独特物品，避免重复计数
    
    const collectItemsRecursively = (currentNode) => {
        // 如果当前节点有物品，则添加到Map中（包括房间）
        if (currentNode.items) {
            currentNode.items.forEach(item => {
                const itemId = item.id || item._id;
                // 只添加不存在的物品，确保每个物品只统计一次
                if (!itemsMap.has(itemId)) {
                    itemsMap.set(itemId, {
                    ...item,
                    containerName: currentNode.name,
                    containerId: currentNode.id || currentNode._id
                });
                }
            });
        }
        
        // 递归处理子容器
        const containers = currentNode.containers || [];
        containers.forEach(child => collectItemsRecursively(child));
    };
    
    collectItemsRecursively(node);
    return Array.from(itemsMap.values()); // 转换为数组并返回
}

/**
 * 收集指定容器及其所有子容器的ID
 */
export function collectAllContainerIds(container) {
    let ids = [container.id];
    
    // 处理子容器 - 使用containers字段（新的数据结构）
    const containers = container.containers || [];
    containers.forEach(child => {
        ids = ids.concat(collectAllContainerIds(child));
    });
    
    return ids;
}

/**
 * 获取指定容器的直接子容器
 */
export function getDirectSubContainers(container) {
    // 防御性检查
    if (!container || !Array.isArray(container.containers)) {
        return [];
    }
    
    return container.containers.filter(subContainer => 
        (container.type === 'room' && (subContainer.parentId === null && subContainer.areaId === container.id || subContainer.parentId === container.id)) ||
        (container.type !== 'room' && subContainer.parentId === container.id)
    );
}

/**
 * 根据ID查找节点（通用）
 * @param {Array} nodes - 节点数组
 * @param {string|number} nodeId - 目标节点ID
 * @param {Array} roomsData - 所有房间数据（可选）
 * @returns {Object|null} - 找到的节点对象或null
 */
export function findNodeById(nodes, nodeId, roomsData = null) {
    // 处理 nodes 未定义或不是数组的情况
    if (!nodes || !Array.isArray(nodes)) {
        // 尝试从所有数据开始查找
        if (nodeId && roomsData) {
            return findNodeById(roomsData, nodeId, roomsData);
        }
        return null;
    }
    
    for (const node of nodes) {
        // 检查 id 或 _id 字段是否匹配（转换为字符串避免类型不匹配）
        if (String(node.id) === String(nodeId) || String(node._id) === String(nodeId)) {
            return node;
        }
        
        // 只处理containers字段（新的数据结构）
        if (node.containers && node.containers.length > 0) {
            const found = findNodeById(node.containers, nodeId, roomsData);
            if (found) return found;
        }
    }
    return null;
}

/**
 * 根据ID获取容器的完整路径
 * @param {Array} nodes - 节点数组
 * @param {string|number} nodeId - 目标节点ID
 * @param {Array} roomsData - 所有房间数据
 * @param {Array} currentPath - 当前路径（内部使用）
 * @param {Set} visitedNodes - 已访问节点ID集合，防止循环引用
 * @returns {string|null} - 完整路径字符串，格式如"玄关-鞋柜"，未找到返回null
 */
export function getContainerPathById(nodes, nodeId, roomsData = null, currentPath = [], visitedNodes = new Set()) {
    // 参数验证
    if (!nodeId) {
        console.warn('getContainerPathById: nodeId 为空');
        return null;
    }
    
    const targetNodeId = String(nodeId);
    
    // 处理 nodes 未定义或不是数组的情况
    if (!nodes || !Array.isArray(nodes)) {
        // 尝试从所有数据开始查找
        if (roomsData && Array.isArray(roomsData)) {
            console.log('getContainerPathById: nodes 无效，尝试从 roomsData 查找');
            return getContainerPathById(roomsData, nodeId, roomsData, [], new Set());
        }
        return null;
    }
    
    for (const node of nodes) {
        // 防御性检查节点对象
        if (!node || typeof node !== 'object') {
            continue;
        }
        
        const nodeIdStr = String(node.id || node._id);
        
        // 防止循环引用
        if (visitedNodes.has(nodeIdStr)) {
            continue;
        }
        visitedNodes.add(nodeIdStr);
        
        // 创建新的路径副本
        const newPath = [...currentPath];
        
        // 只有当节点有名称时才添加到路径中
        if (node.name) {
            newPath.push(node.name);
        }
        
        // 检查 id 或 _id 字段是否匹配
        if (nodeIdStr === targetNodeId) {
            console.log(`getContainerPathById: 找到目标节点，路径为: ${newPath.join('-')}`);
            return newPath.join('-');
        }
        
        // 递归搜索子容器 - 支持多种可能的子容器字段名
        const subContainers = node.containers || [];
        if (subContainers && Array.isArray(subContainers) && subContainers.length > 0) {
            const foundPath = getContainerPathById(subContainers, nodeId, roomsData, newPath, new Set(visitedNodes));
            if (foundPath) {
                return foundPath;
            }
        }
        
        // 特殊处理：如果节点没有子容器但有parentId，尝试通过parentId构建路径
        // 这是为了处理可能的数据结构不一致情况
        if (nodeIdStr === targetNodeId && node.parentId && roomsData) {
            console.log(`getContainerPathById: 找到目标节点，但需要通过parentId构建完整路径`);
            // 获取父容器信息
            const parentNode = findNodeById(roomsData, node.parentId);
            if (parentNode && parentNode.name) {
                return `${parentNode.name}-${node.name}`;
            }
        }
    }
    
    console.log(`getContainerPathById: 未找到节点ID ${targetNodeId} 的完整路径`);
    return null;
}