# 🏠 家庭物料管理系统

一个现代化的家庭物料管理系统，帮助您轻松管理和跟踪家庭中的物品、存储位置和库存情况。

## 🎯 功能特性

### 📊 核心功能
- **区域管理**：创建和管理家庭中的不同区域（如客厅、厨房、卧室等）
- **存储单元层级**：构建嵌套的存储单元结构（如柜子→抽屉→盒子）
- **物品管理**：添加、编辑和删除物品，记录详细信息（名称、分类、数量、位置等）
- **搜索功能**：快速查找物品
- **过期物品检测**：自动检测即将过期的物品
- **库存统计分析**：提供详细的库存统计和分析
- **出入库记录**：记录物品的出入库历史

### 🎨 前端技术特性
- **模块化设计**：基于功能的模块划分，提高代码可维护性
- **事件驱动架构**：通过事件总线实现模块间通信
- **懒加载**：按需加载模块，提高初始加载速度
- **响应式UI**：适配不同屏幕尺寸
- **组件化开发**：复用UI组件

### 🔌 后端技术特性
- **RESTful API**：提供完整的API接口
- **数据库支持**：基于MongoDB
- **CORS配置**：支持跨域请求
- **错误处理**：完善的错误处理机制
- **请求日志**：详细记录API请求

## 📦 技术栈

### 前端
- **HTML5**：页面结构
- **CSS3**：样式设计
- **JavaScript (ES6+)**：核心逻辑
- **原生模块化**：ES Modules
- **事件总线模式**：模块通信

### 后端
- **Node.js**：运行环境
- **Express.js**：Web框架
- **MongoDB**：数据库
- **dotenv**：环境变量管理
- **CORS**：跨域支持

## 📁 项目结构

```
├── backend/                # 后端API
│   ├── config/            # 配置文件
│   │   ├── .env          # 环境变量
│   │   └── database.js   # 数据库连接
│   ├── data/             # 数据文件
│   ├── routes/           # API路由
│   │   ├── areas.js      # 区域管理
│   │   ├── inventory.js  # 库存管理
│   │   ├── items.js      # 物品管理
│   │   └── storage_units.js # 存储单元管理
│   ├── scripts/          # 脚本文件
│   │   └── initData.js   # 数据初始化
│   ├── package-lock.json # 依赖锁定文件
│   ├── package.json      # 后端依赖
│   └── server.js         # 服务器入口
│
└── frontend/              # 前端应用
    ├── assets/           # 静态资源
    │   └── images/       # 图片资源
    ├── components/       # UI组件
    │   ├── ContainerForm.js
    │   ├── ContainerGrid.js
    │   ├── ItemForm.js
    │   ├── ItemTable.js
    │   ├── Modal.js
    │   └── SearchBox.js
    ├── modules/          # 功能模块
    │   ├── app-core.js   # 应用核心
    │   ├── calculations.js # 计算统计
    │   ├── dashboard.js  # 仪表盘
    │   ├── data.js       # 数据服务
    │   ├── eventBus.js   # 事件总线
    │   ├── inventory.js  # 库存管理
    │   ├── materials.js  # 材料管理
    │   ├── navigation.js # 导航系统
    │   ├── state.js      # 状态管理
    │   ├── storage.js    # 存储空间
    │   ├── ui-handlers.js # UI事件处理
    │   └── utils.js      # 工具函数
    ├── index.html        # 主页面
    ├── script.js         # 应用入口
    └── style.css         # 样式文件
```

## 🚀 快速开始

### 1. 环境准备
- **Node.js**：版本 14.x 或更高
- **MongoDB**：本地或远程MongoDB服务

### 2. 后端设置

#### 安装依赖
```bash
cd backend
npm install
```

#### 配置环境变量
编辑 `backend/config/.env` 文件，添加以下内容：
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017
DB_NAME=home_inventory
NODE_ENV=development
```

#### 启动后端服务
```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

后端服务将在 http://localhost:3000 启动

### 3. 前端设置

#### 启动前端服务
```bash
cd frontend
python -m http.server 8000
```

或者使用其他HTTP服务器（如Node.js的http-server）：
```bash
npx http-server -p 8000
```

前端应用将在 http://localhost:8000 启动

### 4. 访问应用
在浏览器中访问 http://localhost:8000

## 📖 API文档

### 主要API端点

| 资源          | 端点                     | 方法  | 功能                |
|---------------|--------------------------|-------|---------------------|
| 区域管理      | `/api/areas`             | GET   | 获取所有区域        |
| 区域管理      | `/api/areas/:areaId`     | GET   | 获取单个区域        |
| 区域管理      | `/api/areas`             | POST  | 创建区域            |
| 区域管理      | `/api/areas/:areaId`     | PUT   | 更新区域            |
| 区域管理      | `/api/areas/:areaId`     | DELETE| 删除区域            |
| 物品管理      | `/api/items`             | GET   | 获取所有物品        |
| 物品管理      | `/api/items/search`      | GET   | 搜索物品            |
| 物品管理      | `/api/items/:itemId`     | GET   | 获取单个物品        |
| 物品管理      | `/api/items`             | POST  | 创建物品            |
| 物品管理      | `/api/items/:itemId`     | PUT   | 更新物品            |
| 物品管理      | `/api/items/:itemId`     | DELETE| 删除物品            |
| 存储单元管理  | `/api/storage_units`     | GET   | 获取所有存储单元    |
| 存储单元管理  | `/api/storage_units/:unitId` | GET | 获取单个存储单元    |
| 存储单元管理  | `/api/storage_units`     | POST  | 创建存储单元        |
| 存储单元管理  | `/api/storage_units/:unitId` | PUT | 更新存储单元        |
| 存储单元管理  | `/api/storage_units/:unitId` | DELETE | 删除存储单元     |
| 库存管理      | `/api/inventory`         | GET   | 获取库存信息        |

### 健康检查
```
GET /health
```
返回系统状态和时间戳

## 📱 前端功能

### 仪表盘
- 显示物品总数、容器数量、材料数量
- 显示存储空间使用情况
- 显示最近添加的物品

### 材料管理
- 分类管理材料
- 查看材料详情
- 搜索材料

### 库存管理
- 查看所有物品
- 筛选和排序物品
- 批量操作

### 存储空间
- 树形结构显示存储单元
- 查看存储单元内容
- 添加子存储单元

### 搜索功能
- 按关键词搜索物品
- 支持条形码扫描
- 显示搜索结果

## 🎨 界面设计

### 布局
- **顶部导航栏**：系统标题和主要功能入口
- **侧边菜单**：功能模块导航
- **主内容区**：根据选择的功能模块显示内容
- **底部信息**：版本信息和操作提示

### 主要界面
- 仪表盘：统计信息
- 材料管理：材料列表和详情
- 库存管理：物品列表
- 存储空间：树形结构
- 搜索：搜索结果

## 🔧 核心模块

### 事件总线模块 (eventBus.js)
实现了发布-订阅模式，用于模块间通信

### 状态管理模块 (state.js)
管理应用的全局状态

### 计算统计模块 (calculations.js)
提供各种统计和计算功能

### UI事件处理模块 (ui-handlers.js)
处理UI交互事件

### 懒加载模块
非核心模块按需加载，提高性能

## 📝 使用说明

### 1. 添加区域
- 点击"添加区域"按钮
- 填写区域信息
- 保存

### 2. 添加存储单元
- 选择父区域或存储单元
- 点击"添加子容器"按钮
- 填写存储单元信息
- 保存

### 3. 添加物品
- 选择存储位置
- 点击"添加物品"按钮
- 填写物品信息
- 保存

### 4. 搜索物品
- 在搜索框中输入关键词
- 点击搜索按钮
- 查看搜索结果

### 5. 查看统计信息
- 点击"仪表盘"菜单
- 查看各种统计数据

## 🔍 常见问题

1. **应用无法连接到后端**
   - 确保后端服务已启动
   - 检查API_BASE配置
   - 检查CORS设置

2. **页面加载缓慢**
   - 确保浏览器支持ES Modules
   - 检查网络连接
   - 考虑使用CDN加速

3. **物品无法添加**
   - 检查表单填写是否完整
   - 检查后端服务器状态
   - 查看控制台错误信息

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request

## 📧 联系方式

如有问题，请通过GitHub Issues反馈

## 📋 版本历史

- v1.0.0 (2025-11-15)：初始版本，包含核心功能

---

**家庭物料管理系统** - 让家庭物品管理变得更简单 🎉