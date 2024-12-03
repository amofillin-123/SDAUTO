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
    
    const usedSpace = (device.used / device.total * 100).toFixed(1);
    const freeSpace = formatSize(device.free);
    
    div.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <div>
                <h5 class="mb-1">${device.name}</h5>
                <small class="text-muted">类型: ${device.type}</small>
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
                <small class="text-muted">可用: ${freeSpace}</small>
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

// 定期刷新设备列表
setInterval(refreshDevices, 5000);

// 页面加载完成时的初始化
console.log('页面加载完成，开始初始化...');
document.addEventListener('DOMContentLoaded', () => {
    checkEnvironment();
    refreshDevices();
});
