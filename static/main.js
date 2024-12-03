// 全局变量
let selectedDevice = null;
let selectedFiles = new Set();
let isCloudEnvironment = false;

// 检查运行环境
async function checkEnvironment() {
    try {
        const response = await fetch('/api/environment');
        const data = await response.json();
        isCloudEnvironment = data.is_cloud;
        
        if (isCloudEnvironment) {
            // 如果在云环境中运行，显示提示信息
            const alert = document.createElement('div');
            alert.className = 'alert alert-info';
            alert.role = 'alert';
            alert.textContent = '当前在云环境中运行，无法访问本地存储设备。';
            document.querySelector('.container').insertBefore(alert, document.querySelector('.row'));
        }
    } catch (error) {
        console.error('Error checking environment:', error);
    }
}

// 刷新设备列表
async function refreshDevices() {
    try {
        const response = await fetch('/api/devices');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const deviceList = document.getElementById('deviceList');
        deviceList.innerHTML = '';

        if (data.devices && data.devices.length > 0) {
            data.devices.forEach(device => {
                const deviceElement = createDeviceElement(device);
                deviceList.appendChild(deviceElement);
            });
        } else {
            deviceList.innerHTML = '<p class="text-muted">未检测到存储设备</p>';
        }
    } catch (error) {
        console.error('刷新设备列表时出错:', error);
        document.getElementById('deviceList').innerHTML = 
            '<div class="alert alert-danger">获取设备列表失败</div>';
    }
}

// 创建设备元素
function createDeviceElement(device) {
    const div = document.createElement('div');
    div.className = 'device-item';
    div.onclick = () => selectDevice(device);
    
    const usedSpace = device.total > 0 ? (device.used / device.total * 100).toFixed(1) : 0;
    const freeSpace = formatSize(device.free);
    
    div.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <h5 class="mb-1">${device.name}</h5>
                <small class="text-muted">类型: ${device.type}</small>
                ${device.isManual ? `<br><small class="text-muted">文件数量: ${device.files.length}</small>` : ''}
            </div>
            <div class="text-end">
                <div class="progress" style="width: 100px;">
                    <div class="progress-bar" role="progressbar" 
                         style="width: ${usedSpace}%" 
                         aria-valuenow="${usedSpace}" 
                         aria-valuemin="0" 
                         aria-valuemax="100">
                    </div>
                </div>
                ${device.isManual ? 
                    `<small class="text-muted">总大小: ${formatSize(device.total)}</small>` :
                    `<small class="text-muted">可用: ${freeSpace}</small>`}
            </div>
        </div>
    `;
    
    if (selectedDevice && selectedDevice.path === device.path) {
        div.classList.add('selected');
    }
    
    return div;
}

// 选择设备
async function selectDevice(device) {
    selectedDevice = device;
    document.querySelectorAll('.device-item').forEach(item => {
        item.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
}

// 格式化文件大小
function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// 处理文件夹选择
async function handleFolderSelect(input) {
    const files = Array.from(input.files);
    if (files.length > 0) {
        const folderPath = files[0].webkitRelativePath.split('/')[0];
        
        try {
            const response = await fetch('/api/scan-manual-folder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    path: folderPath
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            addManualDevice(folderPath, data.files);
            
        } catch (error) {
            console.error('扫描文件夹时出错:', error);
            alert('扫描文件夹时出错，请重试');
        }
    }
}

// 添加手动选择的设备
function addManualDevice(folderPath, files) {
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    const deviceElement = createDeviceElement({
        name: folderPath,
        path: folderPath,
        type: "手动选择的文件夹",
        total: totalSize,
        used: totalSize,
        free: 0,
        files: files,
        isManual: true
    });
    
    const deviceList = document.getElementById('deviceList');
    // 如果列表为空或只有"未检测到设备"的提示，则清空列表
    if (!deviceList.children.length || deviceList.innerHTML.includes('未检测到存储设备')) {
        deviceList.innerHTML = '';
    }
    deviceList.appendChild(deviceElement);
}

// 复制选中的文件
async function copyFiles(files, targetFolder) {
    try {
        const response = await fetch('/api/copy-manual-files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                files: files,
                target_folder: targetFolder
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        alert(`成功复制 ${result.total_copied} 个文件`);
        
    } catch (error) {
        console.error('复制文件时出错:', error);
        alert('复制文件时出错，请重试');
    }
}

// 初始化拖放区域
document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('border-primary');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary');
        
        const items = e.dataTransfer.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if (item && item.isDirectory) {
                    handleDroppedFolder(item);
                    break;
                }
            }
        }
    });
});

// 处理拖放的文件夹
async function handleDroppedFolder(folderEntry) {
    const files = await readFolderContents(folderEntry);
    addManualDevice(folderEntry.name, files);
}

// 递归读取文件夹内容
async function readFolderContents(folderEntry) {
    const files = [];
    
    async function readEntry(entry) {
        if (entry.isFile) {
            const file = await new Promise((resolve) => {
                entry.file(resolve);
            });
            files.push(file);
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            const entries = await new Promise((resolve) => {
                reader.readEntries(resolve);
            });
            for (const childEntry of entries) {
                await readEntry(childEntry);
            }
        }
    }
    
    await readEntry(folderEntry);
    return files;
}

// 定期刷新设备列表
setInterval(refreshDevices, 5000);

// 页面加载完成时的初始化
console.log('页面加载完成，开始初始化...');
document.addEventListener('DOMContentLoaded', () => {
    checkEnvironment();
    refreshDevices();
});
