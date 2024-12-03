document.addEventListener('DOMContentLoaded', function() {
    const deviceList = document.getElementById('deviceList');
    const refreshButton = document.getElementById('refreshDevices');
    const createFolderButton = document.getElementById('createFolder');
    const folderNameInput = document.getElementById('folderName');
    const scanDateInput = document.getElementById('scanDate');
    const photoList = document.getElementById('photoList');
    const videoList = document.getElementById('videoList');
    const photoCount = document.getElementById('photoCount');
    const videoCount = document.getElementById('videoCount');
    const selectAllPhotos = document.getElementById('selectAllPhotos');
    const selectAllVideos = document.getElementById('selectAllVideos');
    const dropZone = document.getElementById('dropZone');
    const folderInput = document.getElementById('folderInput');
    
    // 存储当前选中的设备路径和选中的文件
    let selectedDevicePath = null;
    let selectedFiles = new Set();
    let targetFolder = null;

    // 设置日期选择框的默认值为今天
    const today = new Date();
    scanDateInput.value = today.toISOString().split('T')[0];
    
    // 初始化：获取设备列表
    loadDevices();
    
    // 绑定按钮事件
    refreshButton.addEventListener('click', loadDevices);
    
    // 监听日期变化，自动重新扫描
    scanDateInput.addEventListener('change', () => {
        if (selectedDevicePath) {
            scanDevice(selectedDevicePath, scanDateInput.value);
        }
    });
    
    // 监听文件夹名称输入
    folderNameInput.addEventListener('input', () => {
        createFolderButton.disabled = !folderNameInput.value.trim() || selectedFiles.size === 0;
    });

    // 全选照片
    selectAllPhotos.addEventListener('change', function() {
        const photoItems = photoList.querySelectorAll('.file-item');
        photoItems.forEach(item => {
            if (this.checked) {
                item.classList.add('selected');
                selectedFiles.add(item.getAttribute('data-file-path'));
            } else {
                item.classList.remove('selected');
                selectedFiles.delete(item.getAttribute('data-file-path'));
            }
        });
        updateSelectAllState();
    });

    // 全选视频
    selectAllVideos.addEventListener('change', function() {
        const videoItems = videoList.querySelectorAll('.file-item');
        videoItems.forEach(item => {
            if (this.checked) {
                item.classList.add('selected');
                selectedFiles.add(item.getAttribute('data-file-path'));
            } else {
                item.classList.remove('selected');
                selectedFiles.delete(item.getAttribute('data-file-path'));
            }
        });
        updateSelectAllState();
    });

    // 初始化拖放区域
    initializeDropZone();

    // 加载设备列表
    async function loadDevices() {
        try {
            deviceList.innerHTML = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p>正在搜索存储设备...</p>
                </div>
            `;
            
            const response = await fetch('/api/get-devices');
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            displayDevices(data.devices);
            
        } catch (error) {
            console.error('Error loading devices:', error);
            deviceList.innerHTML = `
                <div class="alert alert-danger">
                    <p>加载设备列表失败: ${error.message}</p>
                    <p>请确保已插入SD卡并正确挂载。</p>
                </div>
            `;
        }
    }
    
    // 显示设备列表
    function displayDevices(devices) {
        if (devices.length === 0) {
            deviceList.innerHTML = `
                <div class="alert alert-info">
                    <p>未找到SD卡</p>
                    <p>请确保：</p>
                    <ul>
                        <li>SD卡已正确插入读卡器</li>
                        <li>SD卡已被系统识别并挂载</li>
                        <li>SD卡中包含DCIM或视频文件夹</li>
                    </ul>
                </div>
            `;
            selectedDevicePath = null;
            return;
        }
        
        deviceList.innerHTML = '';
        devices.forEach(device => {
            const deviceElement = document.createElement('div');
            deviceElement.className = 'device-item';
            deviceElement.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h5 class="mb-0">${device.name}</h5>
                        <small class="text-muted">${device.path}</small>
                    </div>
                    <div class="text-end">
                        <span class="badge bg-primary">${device.type}</span>
                        <div class="text-muted small">
                            可用: ${formatFileSize(device.free)} / 
                            总计: ${formatFileSize(device.total)}
                        </div>
                    </div>
                </div>
            `;
            
            // 点击设备选择
            deviceElement.addEventListener('click', () => {
                document.querySelectorAll('.device-item').forEach(item => {
                    item.classList.remove('selected');
                });
                
                deviceElement.classList.add('selected');
                selectedDevicePath = device.path;
                
                // 自动扫描选中日期的文件
                scanDevice(device.path, scanDateInput.value);
            });
            
            deviceList.appendChild(deviceElement);
        });
    }
    
    // 扫描设备中的文件
    async function scanDevice(devicePath, scanDate) {
        try {
            // 显示加载状态
            const loadingHtml = `
                <div class="text-center">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">加载中...</span>
                    </div>
                    <p>正在扫描文件...</p>
                </div>
            `;
            photoList.innerHTML = loadingHtml;
            videoList.innerHTML = loadingHtml;
            
            const response = await fetch('/api/scan-device', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    devicePath,
                    scanDate 
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // 显示文件列表
            displayFiles(data.photos, data.videos);
            
        } catch (error) {
            console.error('Error scanning device:', error);
            const errorHtml = `
                <div class="alert alert-danger">
                    扫描文件失败: ${error.message}
                </div>
            `;
            photoList.innerHTML = errorHtml;
            videoList.innerHTML = errorHtml;
        }
    }
    
    // 显示文件列表
    function displayFiles(photos, videos) {
        // 清空列表
        photoList.innerHTML = '';
        videoList.innerHTML = '';
        selectedFiles.clear();
        
        // 更新照片列表
        if (photos.length > 0) {
            photos.forEach(photo => {
                const photoElement = createFileElement(photo);
                photoList.appendChild(photoElement);
            });
        } else {
            photoList.innerHTML = '<div class="alert alert-info">没有找到照片</div>';
        }
        
        // 更新视频列表
        if (videos.length > 0) {
            videos.forEach(video => {
                const videoElement = createFileElement(video);
                videoList.appendChild(videoElement);
            });
        } else {
            videoList.innerHTML = '<div class="alert alert-info">没有找到视频</div>';
        }
        
        // 更新计数
        updateFileCount();
        // 更新全选框状态
        updateSelectAllState();
    }
    
    // 创建文件元素
    function createFileElement(file) {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item mb-2';
        fileElement.setAttribute('data-file-path', file.path);

        // 创建缩略图容器
        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.className = 'thumbnail-container me-2';
        thumbnailContainer.style.cssText = 'width: 60px; height: 60px; overflow: hidden; flex-shrink: 0;';

        // 创建缩略图
        const thumbnail = document.createElement('img');
        thumbnail.src = `/api/thumbnail${file.path}`;
        thumbnail.alt = file.name;
        thumbnail.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        thumbnail.onerror = function() {
            this.src = '/static/img/file-icon.png';
        };
        thumbnailContainer.appendChild(thumbnail);

        // 创建文件信息容器
        const fileInfo = document.createElement('div');
        fileInfo.className = 'flex-grow-1';
        fileInfo.innerHTML = `
            <div class="file-name">${file.name}</div>
            <div class="file-info">
                <small class="text-muted">
                    大小: ${formatFileSize(file.size)}
                    <br>
                    日期: ${file.date}
                </small>
            </div>
        `;

        // 创建按钮容器
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'd-flex align-items-center';
        buttonsContainer.style.marginLeft = '10px';

        // 创建跳转按钮
        const openLocationBtn = document.createElement('button');
        openLocationBtn.className = 'btn btn-link btn-sm me-2';
        openLocationBtn.title = '在访达中显示';
        openLocationBtn.innerHTML = '<i class="bi bi-folder2-open"></i>';
        openLocationBtn.onclick = async (event) => {
            event.stopPropagation();
            try {
                const response = await fetch('/api/open-file-location', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ filePath: file.path })
                });
                
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || '无法打开文件位置');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('打开文件位置时出错: ' + error.message);
            }
        };

        // 创建删除按钮
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-link btn-sm text-danger';
        deleteBtn.title = '移除';
        deleteBtn.innerHTML = '<i class="bi bi-x-lg"></i>';
        deleteBtn.onclick = (event) => {
            event.stopPropagation();
            fileElement.remove();
            selectedFiles.delete(file.path);
            updateFileCount();
            updateSelectAllState();
        };

        // 添加按钮到按钮容器
        buttonsContainer.appendChild(openLocationBtn);
        buttonsContainer.appendChild(deleteBtn);

        // 创建主容器
        const container = document.createElement('div');
        container.className = 'd-flex align-items-center';
        container.appendChild(thumbnailContainer);
        container.appendChild(fileInfo);
        container.appendChild(buttonsContainer);

        fileElement.appendChild(container);

        // 点击选择
        fileElement.addEventListener('click', () => {
            fileElement.classList.toggle('selected');
            if (fileElement.classList.contains('selected')) {
                selectedFiles.add(file.path);
            } else {
                selectedFiles.delete(file.path);
            }
            updateSelectAllState();
        });

        return fileElement;
    }
    
    async function copySelectedFiles() {
        try {
            console.log('开始复制文件');
            console.log('目标文件夹:', targetFolder);
            console.log('选中的文件:', Array.from(selectedFiles));
            
            if (!targetFolder) {
                console.error('目标文件夹未设置');
                throw new Error('未指定目标文件夹');
            }
            
            const response = await fetch('/api/copy-files', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    files: Array.from(selectedFiles),
                    targetFolder: targetFolder
                })
            });
            
            console.log('服务器响应状态:', response.status);
            const data = await response.json();
            console.log('服务器响应数据:', data);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // 显示复制结果
            let message = data.message;
            if (data.warning) {
                message += '\n' + data.warning;
                data.failedFiles.forEach(item => {
                    message += `\n${item.file}: ${item.error}`;
                });
            }
            
            alert(message);
            
            // 清除选择
            selectedFiles.clear();
            document.querySelectorAll('.file-item').forEach(item => {
                item.classList.remove('selected');
            });
            updateSelectAllState();
            
        } catch (error) {
            console.error('复制文件时出错:', error);
            console.error('错误堆栈:', error.stack);
            alert('复制文件失败: ' + error.message);
        }
    }
    
    function initializeDropZone() {
        dropZone.addEventListener('click', () => {
            folderInput.click();
        });

        folderInput.addEventListener('change', (event) => {
            const files = event.target.files;
            if (files.length > 0) {
                const file = files[0];
                targetFolder = file.path;
                updateDropZoneText(file.name);
            }
        });

        dropZone.addEventListener('dragover', (event) => {
            event.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (event) => {
            event.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', async (event) => {
            event.preventDefault();
            dropZone.classList.remove('drag-over');
            console.log('文件拖放事件触发');

            const items = event.dataTransfer.items;
            console.log('拖放项数量:', items.length);
            
            for (let item of items) {
                console.log('处理拖放项:', {
                    kind: item.kind,
                    type: item.type
                });
                
                if (item.kind === 'file') {
                    const entry = item.webkitGetAsEntry();
                    console.log('文件系统入口:', {
                        isDirectory: entry?.isDirectory,
                        name: entry?.name,
                        fullPath: entry?.fullPath
                    });
                    
                    if (entry && entry.isDirectory) {
                        try {
                            const response = await fetch('/api/get-folder-path', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    folderName: entry.name,
                                    fullPath: entry.fullPath,
                                    modificationTime: event.dataTransfer.files[0].lastModified,
                                    size: event.dataTransfer.files[0].size
                                })
                            });

                            const data = await response.json();
                            if (data.error) {
                                throw new Error(data.error);
                            }

                            targetFolder = data.path;
                            console.log('获取到目标文件夹路径:', targetFolder);
                            
                            // 检查是否有选中的文件
                            if (selectedFiles.size > 0) {
                                updateDropZoneText(entry.name);
                                await copySelectedFiles();
                            } else {
                                alert('请先选择要复制的文件，然后再次拖入目标文件夹。');
                            }
                        } catch (error) {
                            console.error('获取文件夹路径失败:', error);
                            alert('获取文件夹路径失败: ' + error.message);
                        }
                        break;
                    }
                }
            }
        });
    }
    
    function updateDropZoneText(folderName) {
        if (folderName) {
            dropZone.textContent = `已选择文件夹: ${folderName}`;
        } else {
            dropZone.textContent = '拖放文件夹到这里或点击选择';
        }
    }
    
    function updateFileCount() {
        const photoCount = photoList.querySelectorAll('.file-item').length;
        const videoCount = videoList.querySelectorAll('.file-item').length;
        document.getElementById('photoCount').textContent = `照片 (${photoCount})`;
        document.getElementById('videoCount').textContent = `视频 (${videoCount})`;
    }
    
    function updateSelectAllState() {
        const photoItems = photoList.querySelectorAll('.file-item');
        const videoItems = videoList.querySelectorAll('.file-item');
        
        let allPhotosSelected = true;
        let allVideosSelected = true;
        
        photoItems.forEach(item => {
            if (!item.classList.contains('selected')) {
                allPhotosSelected = false;
            }
        });
        
        videoItems.forEach(item => {
            if (!item.classList.contains('selected')) {
                allVideosSelected = false;
            }
        });
        
        selectAllPhotos.checked = allPhotosSelected && photoItems.length > 0;
        selectAllVideos.checked = allVideosSelected && videoItems.length > 0;
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
});
