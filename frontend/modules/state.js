import eventBus from './eventBus.js';

// 应用核心状态
let state = {
  // 当前选中的区域/容器
  selectedNode: null,
  
  // 当前节点ID（用于存储空间总览）
  currentNodeId: 'overview',
  
  // 过滤条件
  filterConditions: {},
  
  // 搜索参数
  searchParams: {},
  
  // 存储概览状态
  isInStorageOverview: false,
  selectedStorageContainer: null,
  
  // 数据缓存
  cache: {
    rooms: [],
    containers: [],
    items: [],
    areas: [],
    itemStatusConfig: []
  }
};

// 状态管理模块导出对象
const StateModule = {
  /**
   * 获取当前选中的节点
   * @returns {Object|null} 当前选中的区域或容器节点
   */
  getSelectedNode() {
    return state.selectedNode;
  },
  
  /**
   * 设置当前选中的节点
   * @param {Object} node 选中的区域或容器节点
   */
  setSelectedNode(node) {
    state.selectedNode = node;
    eventBus.publish('state:selectedNodeChanged', node);
  },
  
  /**
   * 获取过滤条件
   * @returns {Object} 当前过滤条件
   */
  getFilterConditions() {
    return { ...state.filterConditions };
  },
  
  /**
   * 设置过滤条件
   * @param {Object} conditions 新的过滤条件
   */
  setFilterConditions(conditions) {
    state.filterConditions = { ...conditions };
    eventBus.publish('state:filterChanged', conditions);
  },
  
  /**
   * 更新部分过滤条件
   * @param {Object} partialConditions 部分过滤条件
   */
  updateFilterConditions(partialConditions) {
    state.filterConditions = { ...state.filterConditions, ...partialConditions };
    eventBus.publish('state:filterChanged', state.filterConditions);
  },
  
  /**
   * 获取搜索参数
   * @returns {Object} 当前搜索参数
   */
  getSearchParams() {
    return { ...state.searchParams };
  },
  
  /**
   * 设置搜索参数
   * @param {Object} params 新的搜索参数
   */
  setSearchParams(params) {
    state.searchParams = { ...params };
    eventBus.publish('state:searchParamsChanged', params);
  },
  
  /**
   * 获取当前节点ID
   * @returns {string} 当前节点的容器ID
   */
  getCurrentNodeId() {
    return state.currentNodeId;
  },
  
  /**
   * 设置当前节点ID
   * @param {string} nodeId 当前节点的容器ID
   */
  setCurrentNodeId(nodeId) {
    state.currentNodeId = nodeId;
    eventBus.publish('state:currentNodeChanged', nodeId);
  },
  
  /**
   * 获取缓存数据
   * @param {string} key 缓存键名 (rooms, containers, items, areas)
   * @returns {Array} 缓存的数据
   */
  getCache(key) {
    return key in state.cache ? [...state.cache[key]] : [];
  },
  
  /**
   * 设置缓存数据
   * @param {string} key 缓存键名
   * @param {Array} data 要缓存的数据
   */
  setCache(key, data) {
    if (key in state.cache) {
      state.cache[key] = [...data];
      eventBus.publish('state:cacheUpdated', { key, data });
    }
  },
  
  /**
   * 清空所有缓存
   */
  clearCache() {
    state.cache = {
      rooms: [],
      containers: [],
      items: [],
      areas: []
    };
    eventBus.publish('state:cacheCleared');
  },
  
  /**
   * 获取存储概览状态
   * @returns {boolean} 是否在存储概览页面
   */
  getIsInStorageOverview() {
    return state.isInStorageOverview;
  },
  
  /**
   * 设置存储概览状态
   * @param {boolean} isOverview 是否在存储概览页面
   */
  setIsInStorageOverview(isOverview) {
    state.isInStorageOverview = isOverview;
    eventBus.publish('state:storageOverviewChanged', isOverview);
  },
  
  /**
   * 获取当前选中的存储容器
   * @returns {Object|null} 当前选中的存储容器
   */
  getSelectedStorageContainer() {
    return state.selectedStorageContainer;
  },
  
  /**
   * 设置当前选中的存储容器
   * @param {Object|null} container 当前选中的存储容器
   */
  setSelectedStorageContainer(container) {
    state.selectedStorageContainer = container;
    eventBus.publish('state:selectedStorageContainerChanged', container);
  },
  
  /**
   * 获取完整的应用状态
   * @returns {Object} 完整的应用状态
   */
  getState() {
    // 使用递归深拷贝，并处理循环引用
    const deepCopy = (obj, seen = new Set()) => {
      if (typeof obj !== 'object' || obj === null || seen.has(obj)) {
        return obj;
      }
      seen.add(obj);
      const copy = Array.isArray(obj) ? [] : {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          copy[key] = deepCopy(obj[key], seen);
        }
      }
      seen.delete(obj);
      return copy;
    };
    return deepCopy(state); // 深拷贝，防止外部直接修改状态
  }
};

export default StateModule;