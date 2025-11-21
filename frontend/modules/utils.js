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
    return (node.id || node._id) && (node.containers || node.items || node.type || node.containerType);
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

// 不再需要findContainerById方法，已合并到findNodeById方法


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