# SD卡文件复制工具

这是一个基于 Flask 的网页应用，用于快速从 SD 卡复制照片和视频文件。

## 功能特点

- 自动识别并扫描 SD 卡设备
- 按日期筛选文件
- 支持照片和视频文件预览
- 支持多文件选择和批量复制
- 自动处理文件名冲突
- 支持拖拽目标文件夹

## 系统要求

- Python 3.6+
- macOS 操作系统
- 现代浏览器（Chrome、Firefox、Safari）

## 依赖库

```bash
Flask==2.0.1
Pillow==8.3.1
psutil==5.8.0
```

## 安装步骤

1. 克隆或下载本项目
2. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```
3. 运行应用：
   ```bash
   python app.py
   ```
4. 在浏览器中访问：`http://localhost:3000`

## 使用说明

1. 将 SD 卡插入电脑
2. 打开应用后，系统会自动识别 SD 卡设备
3. 选择日期筛选文件
4. 选择要复制的文件
5. 将目标文件夹拖入指定区域完成复制

## 支持的文件类型

- 照片：.jpg, .jpeg, .png, .raw, .arw
- 视频：.mp4, .mov, .mxf

## 注意事项

- 确保 SD 卡正确挂载
- 确保目标文件夹有足够的存储空间
- 复制大文件时请耐心等待
- 不要在复制过程中移除 SD 卡

## 技术架构

- 后端：Flask (Python)
- 前端：HTML5, Bootstrap 5, JavaScript
- 文件处理：Python 标准库 (os, shutil)
- 图片处理：Pillow
- 设备检测：psutil

## 开发者说明

- `app.py`: 主应用文件，包含所有后端逻辑
- `templates/`: 包含 HTML 模板
- `static/`: 包含 CSS、JavaScript 和其他静态资源

## Windows 用户使用说明

### 安装 Python

1. 访问 [Python 官网](https://www.python.org/downloads/)
2. 下载并安装 Python 3.8 或更高版本
3. 安装时勾选 "Add Python to PATH"

### 下载程序

1. 下载本程序的 zip 文件
2. 解压到任意目录，如 `C:\FilesCopy`

### 安装依赖

1. 打开命令提示符（按 Win+R，输入 cmd）
2. 进入程序目录：`cd C:\FilesCopy`（根据实际解压位置修改）
3. 运行：`pip install -r requirements.txt`

### 运行程序

1. **启动服务器**
   - 打开命令提示符
   - 进入程序目录
   - 运行：`python app.py`
   - 服务器将在 http://localhost:3000 启动

2. **使用程序**
   - 在浏览器中打开 http://localhost:3000
   - 插入 SD 卡或连接相机
   - 程序会自动检测可用的存储设备
   - 选择要复制的文件
   - 选择目标文件夹
   - 点击复制开始传输

## License

MIT License
