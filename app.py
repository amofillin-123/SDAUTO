from flask import Flask, render_template, request, jsonify, send_file
import os
import platform
from datetime import datetime
import time
import psutil
import json
from PIL import Image
import io
import mimetypes
import shutil

app = Flask(__name__)

def get_file_date(file_path):
    """获取文件的创建日期"""
    # 获取文件的修改时间
    timestamp = os.path.getmtime(file_path)
    return datetime.fromtimestamp(timestamp)

def is_same_date(date1, date2):
    """比较两个日期是否是同一天"""
    return (date1.year == date2.year and 
            date1.month == date2.month and 
            date1.day == date2.day)

def is_cloud_environment():
    """检查是否在云环境中运行"""
    return os.environ.get('ZEABUR') == 'true' or not os.environ.get('USER')

@app.route('/api/environment')
def get_environment():
    """获取当前运行环境信息"""
    return jsonify({
        "is_cloud": is_cloud_environment(),
        "platform": platform.system()
    })

def get_mounted_devices():
    """获取已挂载的存储设备"""
    print("开始检测存储设备...")
    print(f"运行环境: {'云端' if is_cloud_environment() else '本地'}")
    print(f"操作系统: {platform.system()}")
    
    # 如果在云环境中运行，返回空列表
    if is_cloud_environment():
        print("检测到云环境，跳过设备检测")
        return []
        
    devices = []
    system = platform.system()
    
    # 获取所有磁盘分区
    partitions = psutil.disk_partitions(all=True)
    print(f"检测到 {len(partitions)} 个分区")
    
    for partition in partitions:
        print(f"\n检查分区: {partition.mountpoint}")
        print(f"分区类型: {partition.fstype}")
        print(f"分区选项: {partition.opts}")
        
        try:
            # Windows 系统
            if system == "Windows":
                if 'removable' in partition.opts.lower():
                    usage = psutil.disk_usage(partition.mountpoint)
                    is_camera_storage = False
                    
                    try:
                        possible_paths = [
                            os.path.join(partition.mountpoint, "DCIM"),
                            os.path.join(partition.mountpoint, "PRIVATE", "M4ROOT", "CLIP"),
                            os.path.join(partition.mountpoint, "DCIM", "100CANON"),
                            os.path.join(partition.mountpoint, "DCIM", "100NIKON"),
                            os.path.join(partition.mountpoint, "DCIM", "100FUJI")
                        ]
                        
                        for path in possible_paths:
                            if os.path.exists(path):
                                is_camera_storage = True
                                break
                    except:
                        pass
                        
                    if is_camera_storage:
                        try:
                            import ctypes
                            kernel32 = ctypes.windll.kernel32
                            volumeNameBuffer = ctypes.create_unicode_buffer(1024)
                            fileSystemNameBuffer = ctypes.create_unicode_buffer(1024)
                            
                            rc = kernel32.GetVolumeInformationW(
                                partition.mountpoint,
                                volumeNameBuffer,
                                ctypes.sizeof(volumeNameBuffer),
                                None, None, None,
                                fileSystemNameBuffer,
                                ctypes.sizeof(fileSystemNameBuffer)
                            )
                            
                            device_name = volumeNameBuffer.value if rc else os.path.basename(partition.mountpoint)
                        except:
                            device_name = os.path.basename(partition.mountpoint)
                            
                        devices.append({
                            "name": device_name or f"可移动磁盘 ({partition.mountpoint})",
                            "path": partition.mountpoint,
                            "total": usage.total,
                            "used": usage.used,
                            "free": usage.free,
                            "type": "SD卡"
                        })
                        
            # macOS 系统
            elif system == "Darwin" and partition.mountpoint.startswith("/Volumes/"):
                print("检测到 macOS 系统分区")
                # 跳过系统分区
                if partition.mountpoint == "/Volumes/Macintosh HD":
                    print("跳过系统分区")
                    continue
                    
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    print(f"分区大小: {usage.total / (1024*1024*1024):.2f} GB")
                    
                    # 检查常见的相机存储结构
                    possible_paths = [
                        os.path.join(partition.mountpoint, "DCIM"),
                        os.path.join(partition.mountpoint, "PRIVATE/M4ROOT/CLIP"),
                        os.path.join(partition.mountpoint, "DCIM/100CANON"),
                        os.path.join(partition.mountpoint, "DCIM/100NIKON"),
                        os.path.join(partition.mountpoint, "DCIM/100FUJI")
                    ]
                    
                    print("检查相机文件夹结构:")
                    for path in possible_paths:
                        exists = os.path.exists(path)
                        print(f"- {path}: {'存在' if exists else '不存在'}")
                        if exists:
                            print("找到相机存储设备！")
                            device_name = os.path.basename(partition.mountpoint)
                            devices.append({
                                "name": device_name,
                                "path": partition.mountpoint,
                                "total": usage.total,
                                "used": usage.used,
                                "free": usage.free,
                                "type": "SD卡"
                            })
                            break
                            
                except (PermissionError, OSError) as e:
                    print(f"访问分区时出错: {str(e)}")
                    continue
                    
        except Exception as e:
            print(f"处理分区时出错: {str(e)}")
            continue
            
    print(f"\n找到 {len(devices)} 个存储设备")
    return devices

@app.route('/api/devices')
def list_devices():
    """列出可用的存储设备"""
    try:
        devices = get_mounted_devices()
        print(f"返回设备列表: {devices}")
        return jsonify(devices)
    except Exception as e:
        print(f"获取设备列表时出错: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/get-devices', methods=['GET'])
def get_devices():
    """获取可用的存储设备列表"""
    try:
        devices = get_mounted_devices()
        return jsonify({"devices": devices})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/scan-device', methods=['POST'])
def scan_device():
    """扫描指定设备中的指定日期的文件"""
    data = request.json
    device_path = data.get('devicePath')
    scan_date_str = data.get('scanDate')
    
    if not device_path or not os.path.exists(device_path):
        return jsonify({"error": "设备路径无效"}), 400
        
    if not scan_date_str:
        return jsonify({"error": "未指定日期"}), 400
    
    try:
        # 解析日期字符串（格式：YYYY-MM-DD）
        scan_date = datetime.strptime(scan_date_str, '%Y-%m-%d')
        scan_date = scan_date.replace(hour=0, minute=0, second=0, microsecond=0)
    except ValueError:
        return jsonify({"error": "日期格式无效"}), 400
    
    result = {
        "photos": [],
        "videos": [],
        "error": None
    }
    
    try:
        # 使用固定的照片和视频路径
        photo_path = os.path.join(device_path, "DCIM", "100MSDCF")
        video_path = os.path.join(device_path, "PRIVATE", "M4ROOT", "CLIP")
        
        # 扫描照片
        if os.path.exists(photo_path):
            for file in os.listdir(photo_path):
                if file.lower().endswith(('.jpg', '.jpeg', '.png', '.raw', '.arw')):
                    file_path = os.path.join(photo_path, file)
                    file_date = get_file_date(file_path)
                    
                    if is_same_date(file_date, scan_date):
                        file_size = os.path.getsize(file_path)
                        result["photos"].append({
                            "name": file,
                            "path": file_path,
                            "size": file_size,
                            "date": file_date.strftime("%Y-%m-%d %H:%M:%S")
                        })
        
        # 扫描视频
        if os.path.exists(video_path):
            for file in os.listdir(video_path):
                if file.lower().endswith(('.mp4', '.mov', '.mxf')):
                    file_path = os.path.join(video_path, file)
                    file_date = get_file_date(file_path)
                    
                    if is_same_date(file_date, scan_date):
                        file_size = os.path.getsize(file_path)
                        result["videos"].append({
                            "name": file,
                            "path": file_path,
                            "size": file_size,
                            "date": file_date.strftime("%Y-%m-%d %H:%M:%S")
                        })
        
        # 按日期排序
        result["photos"].sort(key=lambda x: x["date"], reverse=True)
        result["videos"].sort(key=lambda x: x["date"], reverse=True)
        
        return jsonify(result)
        
    except Exception as e:
        result["error"] = str(e)
        return jsonify(result), 500

@app.route('/api/copy-files', methods=['POST'])
def copy_files():
    """复制文件到指定目录"""
    try:
        data = request.json
        files = data.get('files', [])
        target_folder = data.get('targetFolder')
        
        if not files:
            return jsonify({"error": "未选择任何文件"}), 400
            
        if not target_folder:
            return jsonify({"error": "未指定目标文件夹"}), 400
            
        # 确保目标文件夹存在
        if not os.path.exists(target_folder):
            return jsonify({"error": "目标文件夹不存在"}), 400
            
        # 复制文件
        success_count = 0
        failed_files = []
        
        for file_path in files:
            try:
                if not os.path.exists(file_path):
                    failed_files.append({"file": file_path, "error": "文件不存在"})
                    continue
                    
                # 获取文件名
                file_name = os.path.basename(file_path)
                # 构建目标文件路径
                dest_path = os.path.join(target_folder, file_name)
                
                # 如果目标文件已存在，添加数字后缀
                base_name, ext = os.path.splitext(file_name)
                counter = 1
                while os.path.exists(dest_path):
                    dest_path = os.path.join(target_folder, f"{base_name}_{counter}{ext}")
                    counter += 1
                
                # 复制文件
                shutil.copy2(file_path, dest_path)
                success_count += 1
                
            except Exception as e:
                failed_files.append({"file": file_path, "error": str(e)})
        
        # 准备返回信息
        result = {
            "message": f"成功复制 {success_count} 个文件到 {target_folder}",
            "targetPath": target_folder,
            "successCount": success_count,
            "failedFiles": failed_files
        }
        
        if failed_files:
            result["warning"] = f"有 {len(failed_files)} 个文件复制失败"
            
        return jsonify(result)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/create-folder-and-copy', methods=['POST'])
def create_folder_and_copy():
    """创建文件夹并复制文件"""
    try:
        data = request.json
        folder_name = data.get('folderName')
        file_paths = data.get('filePaths', [])
        
        if not folder_name or not file_paths:
            return jsonify({"error": "缺少必要参数"}), 400
            
        # 在桌面创建文件夹
        desktop_path = os.path.expanduser("~/Desktop")
        target_folder = os.path.join(desktop_path, folder_name)
        
        # 如果文件夹已存在，添加数字后缀
        original_folder = target_folder
        counter = 1
        while os.path.exists(target_folder):
            target_folder = f"{original_folder}_{counter}"
            counter += 1
        
        # 创建文件夹
        os.makedirs(target_folder)
        
        # 复制文件
        copied_files = []
        for file_path in file_paths:
            if os.path.exists(file_path):
                file_name = os.path.basename(file_path)
                target_path = os.path.join(target_folder, file_name)
                try:
                    with open(file_path, 'rb') as src, open(target_path, 'wb') as dst:
                        dst.write(src.read())
                    copied_files.append(file_name)
                except Exception as e:
                    print(f"Error copying file {file_path}: {str(e)}")
        
        return jsonify({
            "success": True,
            "message": f"已创建文件夹并复制了 {len(copied_files)} 个文件",
            "folderPath": target_folder,
            "copiedFiles": copied_files
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/thumbnail/<path:file_path>')
def get_thumbnail(file_path):
    """获取文件的缩略图"""
    try:
        # 解码文件路径
        file_path = '/' + file_path
        
        if not os.path.exists(file_path):
            return jsonify({"error": "文件不存在"}), 404
            
        # 生成缩略图
        thumb_io = generate_thumbnail(file_path)
        if thumb_io:
            return send_file(thumb_io, mimetype='image/jpeg')
        else:
            return jsonify({"error": "不支持的文件类型"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/open-file-location', methods=['POST'])
def open_file_location():
    """打开文件所在位置"""
    try:
        data = request.json
        file_path = data.get('filePath')
        
        if not file_path or not os.path.exists(file_path):
            return jsonify({"error": "文件不存在"}), 404
            
        # 获取文件所在目录
        dir_path = os.path.dirname(file_path)
        
        # 在 macOS 上使用 open 命令打开 Finder
        if platform.system() == "Darwin":
            os.system(f'open -R "{file_path}"')
            return jsonify({"success": True})
        else:
            return jsonify({"error": "不支持的操作系统"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-folder-path', methods=['POST'])
def get_folder_path():
    """获取拖放文件夹的完整路径"""
    try:
        data = request.json
        folder_name = data.get('folderName')
        
        if not folder_name:
            return jsonify({"error": "未提供文件夹名称"}), 400
            
        # 在常见位置查找文件夹
        possible_locations = [
            os.path.expanduser("~/Desktop"),  # 桌面
            os.path.expanduser("~/Downloads"),  # 下载文件夹
            "/Volumes"  # 外部设备
        ]
        
        # 遍历所有可能的位置
        for location in possible_locations:
            if os.path.exists(location):
                for root, dirs, _ in os.walk(location):
                    if folder_name in dirs:
                        folder_path = os.path.join(root, folder_name)
                        # 验证这是我们要找的文件夹
                        try:
                            folder_stat = os.stat(folder_path)
                            # 如果提供了修改时间，可以用来进一步验证
                            if 'modificationTime' in data:
                                # 转换时间戳（毫秒转秒）
                                mod_time = data['modificationTime'] / 1000
                                # 允许1秒的误差
                                if abs(folder_stat.st_mtime - mod_time) > 1:
                                    continue
                            
                            # 如果提供了大小信息，可以用来进一步验证
                            if 'size' in data and folder_stat.st_size != data['size']:
                                continue
                                
                            return jsonify({"path": folder_path})
                        except OSError:
                            continue
        
        return jsonify({"error": "找不到指定的文件夹"}), 404
        
    except Exception as e:
        print(f"获取文件夹路径时出错: {str(e)}")
        return jsonify({"error": str(e)}), 500

def get_video_thumbnail_path(video_path):
    """获取视频对应的缩略图路径"""
    if not video_path.startswith('/Volumes/Untitled/PRIVATE/M4ROOT/CLIP/'):
        return None
        
    # 从视频路径中提取文件名
    video_name = os.path.basename(video_path)
    video_name_without_ext = os.path.splitext(video_name)[0]
    
    # 构建缩略图路径 (添加T01后缀)
    thumbnail_path = f'/Volumes/Untitled/PRIVATE/M4ROOT/THMBNL/{video_name_without_ext}T01.JPG'
    
    if os.path.exists(thumbnail_path):
        return thumbnail_path
    return None

def generate_thumbnail(file_path, size=(150, 150)):
    """生成缩略图"""
    try:
        # 如果是视频文件，尝试获取其缩略图
        if file_path.lower().endswith(('.mp4', '.mov', '.mxf')):
            thumb_path = get_video_thumbnail_path(file_path)
            if thumb_path:
                try:
                    # 直接打开 JPG 缩略图文件
                    with Image.open(thumb_path) as img:
                        # 保持纵横比
                        img.thumbnail(size)
                        # 将图片转换为字节流
                        thumb_io = io.BytesIO()
                        img.save(thumb_io, 'JPEG', quality=85)
                        thumb_io.seek(0)
                        return thumb_io
                except Exception as e:
                    print(f"Error processing thumbnail file {thumb_path}: {str(e)}")
                    return None
        
        # 检查文件类型
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type or not mime_type.startswith('image/'):
            return None
            
        # 打开图片并生成缩略图
        with Image.open(file_path) as img:
            # 保持纵横比
            img.thumbnail(size)
            # 将图片转换为字节流
            thumb_io = io.BytesIO()
            img.save(thumb_io, 'JPEG', quality=85)
            thumb_io.seek(0)
            return thumb_io
    except Exception as e:
        print(f"Error generating thumbnail for {file_path}: {str(e)}")
        return None

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port)
