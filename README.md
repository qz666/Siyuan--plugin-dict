# 📖 思源笔记离线词典插件 (SiYuan Dict)

本插件基于开源词典数据库 [ECDICT](https://www.google.com/url?sa=E&q=https%3A%2F%2Fgithub.com%2Fskywind3000%2FECDICT) 开发

------



## 🚀 安装步骤

### 1. 部署插件包

将解压后的插件文件夹 siyuan-plugin-dict 放入思源笔记的 **数据目录**（Data Directory）中：

> **注意：** 请区分“安装目录”与“数据目录”，插件需存放在数据目录下。

- **路径：** [你的数据目录]/data/plugins/siyuan-plugin-dict
- **示例：** D:\SiYuanData\data\plugins\siyuan-plugin-dict

------



### 2. 配置词典数据库

本插件需配合 **ECDICT SQLite** 版本使用。

1. **下载词典：** 前往 [ECDICT Releases](https://www.google.com/url?sa=E&q=https%3A%2F%2Fgithub.com%2Fskywind3000%2FECDICT%2Freleases) 下载 ecdict-sqlite-28.zip。
2. **放置数据：** 解压得到 .db 文件，并将其放入插件内的 dict 文件夹中。
3. **重命名：** 确保数据库文件路径完整如下：
   .../siyuan-plugin-dict/dict/stardict.db

------



### 3. 启用插件

1. 启动或重启 **思源笔记**。
2. 进入 设置 -> 插件 页面。
3. 在“已安装”列表中找到 **Dict** 插件，点击开关开启。
4. 若未显示，请尝试点击右上角的 **刷新** 按钮。

------



## 🛠️ 功能特性与进阶

### 1. 核心效果

- **划词翻译：** 在编辑器中选中英文单词，即可弹出详细释义。
- **离线查询：** 基于 SQLite 本地数据库，无需联网，极速响应。

### 2. 效果展示



**插件管理界面：**

![CopyQ.XljQGc](D:\思源笔记\data\plugins\siyuan-plugin-dict\pic\CopyQ.XljQGc.png)



**查词效果：**

![CopyQ.OYAueq](D:\思源笔记\data\plugins\siyuan-plugin-dict\pic\CopyQ.OYAueq.png)





![CopyQ.YTQxQl](D:\思源笔记\data\plugins\siyuan-plugin-dict\pic\CopyQ.YTQxQl.png)

### 3. 自定义扩展

如果你希望使用其他词典数据库（如朗文、牛津等），只需确保数据库格式为 SQLite，并参考源码中的字段映射进行逻辑适配。