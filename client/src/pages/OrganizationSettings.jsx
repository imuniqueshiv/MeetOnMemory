import React, {
  useState,
  useEffect,
  useContext,
  useRef,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Building2,
  Shield,
  Globe,
  Mail,
  MapPin,
  Briefcase,
  FileText,
  Info,
  Calendar,
  Users,
  Copy,
  Check,
  Save,
  RotateCcw,
  Loader2,
  ChevronRight,
  AlertCircle,
  Lock,
  ExternalLink,
  Image as ImageIcon,
  PanelsTopLeft,
  Blocks,
  Upload,
  X,
  Trash2,
  Eye,
  Download,
  RefreshCw,
  FileImage,
  CheckCircle,
  AlertTriangle,
  Clock,
  Camera,
  FolderOpen,
  Sparkles,
  Settings,
  User,
  Link,
  Cloud,
  CloudOff,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Contrast,
  Sliders,
  Palette,
  Crop,
  Grid,
  Layout,
  Columns,
  Rows,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Type,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link2,
  Image,
  Video,
  Music,
  File,
  Folder,
  Archive,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Grid3x3,
  ListChecks,
  Square,
  Circle,
  Triangle,
  Hexagon,
  Pentagon,
  Star,
  Heart,
  Award,
  Trophy,
  Medal,
  Crown,
  Gem,
  Diamond,
  Sparkle,
  Zap,
  Flame,
  Sun,
  Moon,
  CloudRain,
  Snowflake,
  Wind,
  Droplet,
  EyeOff,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Headphones,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Tv,
  Radio,
  Wifi,
  Bluetooth,
  Battery,
  BatteryCharging,
  Signal,
  Cpu,
  HardDrive,
  Database,
  Server,
  Cloudy,
  Thermometer,
  Activity,
  HeartPulse,
  Brain,
  MonitorSmartphone,
  TabletSmartphone,
  LaptopMinimal,
  TvMinimal,
  RadioReceiver,
  WifiHigh,
  BluetoothConnected,
  BatteryFull,
  SignalHigh,
  HardDriveDownload,
  DatabaseZap,
  ServerCog,
  CloudUpload,
  CloudDownload,
  CloudSnow,
  CloudSun,
  CloudMoon,
  CloudRainWind,
  CloudLightning,
  CloudHail,
  CloudFog,
  CloudDrizzle,
  CloudSunRain,
  CloudMoonRain,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import { organizationApi } from "../services/organizationApi.js";
import OrganizationLogo from "../components/organization/OrganizationLogo.jsx";
import OrganizationBanner from "../components/organization/OrganizationBanner.jsx";
import { validateImageUrl } from "../utils/imageUrl.js";
import NotionConnectPanel from "../components/integrations/NotionConnectPanel.jsx";
import GitHubConnectPanel from "../components/integrations/GitHubConnectPanel.jsx";
import SlackConnectPanel from "../components/integrations/SlackConnectPanel.jsx";
import IssueTrackerConfig from "../components/integrations/IssueTrackerConfig.jsx";

import OrgCustomFieldsSection from "../components/organization/OrgCustomFieldsSection.jsx";
import CostConfigSettings from "../components/organization/CostConfigSettings.jsx";
import SlaConfigPanel from "../components/organization/SlaConfigPanel.jsx";
import E2eeRolloutPanel from "../components/organization/E2eeRolloutPanel.jsx";

// Image editor component
const ImageEditor = ({ imageUrl, onSave, onCancel, onClose }) => {
  const canvasRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipX, setFlipX] = useState(false);
  const [flipY, setFlipY] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [cropMode, setCropMode] = useState(false);
  const [cropArea] = useState({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });

  const handleImageLoad = (e) => {
    const img = e.target;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
  };

  const applyEdits = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;

    img.onload = () => {
      // Set canvas size
      canvas.width = img.width;
      canvas.height = img.height;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Save context state
      ctx.save();

      // Apply transformations
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.scale(scale, scale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Apply image filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Restore context
      ctx.restore();

      // Update preview
      const previewUrl = canvas.toDataURL("image/png");
      const previewImg = document.getElementById("preview-image");
      if (previewImg) {
        previewImg.src = previewUrl;
      }
    };
  }, [imageUrl, rotation, flipX, flipY, scale, brightness, contrast]);

  useEffect(() => {
    if (imageLoaded) {
      applyEdits();
    }
  }, [
    applyEdits,
    imageLoaded,
    rotation,
    flipX,
    flipY,
    scale,
    brightness,
    contrast,
  ]);

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      onSave(dataUrl);
    }
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setFlipX(false);
    setFlipY(false);
    setBrightness(100);
    setContrast(100);
    setCropMode(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-xl">
              <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Image Editor
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Crop, rotate, and enhance your image
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto p-4 bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center min-h-[300px]">
          <div className="relative max-w-full max-h-full">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full object-contain"
              style={{ display: "none" }}
            />
            <img
              id="preview-image"
              src={imageUrl}
              alt="Preview"
              className="max-w-full max-h-[50vh] object-contain"
              onLoad={handleImageLoad}
              crossOrigin="anonymous"
            />
            {cropMode && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-500/10 cursor-move"
                style={{
                  left: `${cropArea.x}%`,
                  top: `${cropArea.y}%`,
                  width: `${cropArea.width}%`,
                  height: `${cropArea.height}%`,
                }}
              >
                <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize" />
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize" />
                <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize" />
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize" />
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 max-h-[300px] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Transform Controls */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Scale
              </label>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-slate-500">
                {scale.toFixed(1)}x
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Rotation
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={rotation}
                onChange={(e) => setRotation(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-slate-500">{rotation}°</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Brightness
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={brightness}
                onChange={(e) => setBrightness(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-slate-500">{brightness}%</span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Contrast
              </label>
              <input
                type="range"
                min="0"
                max="200"
                value={contrast}
                onChange={(e) => setContrast(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-slate-500">{contrast}%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 mt-4 justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFlipX(!flipX)}
                className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              >
                <FlipHorizontal className="w-4 h-4" />
                Flip H
              </button>
              <button
                onClick={() => setFlipY(!flipY)}
                className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              >
                <FlipVertical className="w-4 h-4" />
                Flip V
              </button>
              <button
                onClick={() => setCropMode(!cropMode)}
                className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Crop className="w-4 h-4" />
                Crop
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Drag and drop file upload component
const FileDropZone = ({
  onFileSelect,
  accept = "image/*",
  maxSize = 5 * 1024 * 1024,
  multiple = false,
  children,
  className = "",
  disabled = false,
  label = "Drop files here or click to browse",
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isDragOver) {
        setIsDragOver(true);
      }
    },
    [isDragOver],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        // Validate files
        const validFiles = files.filter((file) => {
          if (file.size > maxSize) {
            toast.error(
              `File "${file.name}" exceeds ${(maxSize / (1024 * 1024)).toFixed(1)}MB limit`,
            );
            return false;
          }
          if (!file.type.startsWith("image/")) {
            toast.error(`File "${file.name}" is not an image`);
            return false;
          }
          return true;
        });

        if (validFiles.length > 0) {
          if (!multiple) {
            onFileSelect(validFiles[0]);
          } else {
            onFileSelect(validFiles);
          }
        }
      }
    },
    [disabled, maxSize, multiple, onFileSelect],
  );

  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback(
    (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        if (!multiple) {
          onFileSelect(files[0]);
        } else {
          onFileSelect(files);
        }
      }
      // Reset input
      e.target.value = "";
    },
    [multiple, onFileSelect],
  );

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all ${
        isDragOver
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-105"
          : "border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />
      {children || (
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {isDragOver ? "Drop to upload" : label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supports {accept.replace(/\*/g, "")} up to{" "}
              {(maxSize / (1024 * 1024)).toFixed(1)}MB
            </p>
          </div>
          {!multiple && (
            <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Choose File
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Upload progress component
const UploadProgress = ({ progress, isUploading, fileName, onCancel }) => {
  if (!isUploading && progress === 0) return null;

  return (
    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[70%]">
          {fileName || "Uploading..."}
        </span>
        <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="relative w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
        {isUploading && (
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full animate-pulse"
            style={{ width: `${progress}%` }}
          />
        )}
      </div>
      {onCancel && isUploading && (
        <button
          onClick={onCancel}
          className="mt-2 text-xs text-red-600 hover:text-red-700 transition-colors"
        >
          Cancel Upload
        </button>
      )}
    </div>
  );
};

// Image preview with overlay
const ImagePreview = ({
  src,
  alt,
  onRemove,
  onEdit,
  onDownload,
  size = "md",
  showControls = true,
  className = "",
  isUploading = false,
  uploadProgress = 0,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showFullScreen, setShowFullScreen] = useState(false);

  const sizeClasses = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32",
    xl: "w-48 h-48",
    "2xl": "w-64 h-64",
  };

  if (!src) return null;

  return (
    <>
      <div
        className={`relative group ${sizeClasses[size] || sizeClasses.md} ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={src}
          alt={alt || "Preview"}
          className="w-full h-full object-cover rounded-xl border border-slate-200 dark:border-slate-700"
        />

        {isUploading && (
          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-6 h-6 text-white animate-spin mx-auto mb-1" />
              <span className="text-xs text-white">
                {Math.round(uploadProgress)}%
              </span>
            </div>
          </div>
        )}

        {showControls && isHovered && !isUploading && (
          <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center gap-2 transition-opacity">
            <button
              onClick={() => setShowFullScreen(true)}
              className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
              title="View full screen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            {onEdit && (
              <button
                onClick={onEdit}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                title="Edit image"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                title="Download image"
              >
                <Download className="w-4 h-4" />
              </button>
            )}
            {onRemove && (
              <button
                onClick={onRemove}
                className="p-2 bg-red-500/80 hover:bg-red-600 rounded-lg text-white transition-colors"
                title="Remove image"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full screen modal */}
      {showFullScreen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowFullScreen(false)}
        >
          <div
            className="max-w-4xl w-full max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={src}
              alt={alt || "Preview"}
              className="w-full h-full object-contain rounded-xl"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              {onEdit && (
                <button
                  onClick={() => {
                    setShowFullScreen(false);
                    if (onEdit) onEdit();
                  }}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
                >
                  <Sliders className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setShowFullScreen(false)}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Main component
const OrganizationSettings = () => {
  const navigate = useNavigate();
  const { getUserData, setUserData } = useContext(AppContent);

  // Loading & state management
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [userRole, setUserRole] = useState("member");
  const [canEdit, setCanEdit] = useState(false);

  // Original fetched data for dirty state detection
  const [initialData, setInitialData] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    about: "",
    website: "",
    contactEmail: "",
    industry: "",
    location: "",
    logo: "",
    bannerUrl: "",
    visibility: "private",
    joinPolicy: "open",
  });

  // Metadata State
  const [metadata, setMetadata] = useState({
    _id: "",
    slug: "",
    createdAt: null,
    updatedAt: null,
    owner: null,
    memberCount: 0,
  });

  // E2EE Rollout State (#2263)
  const [e2eeSettings, setE2eeSettings] = useState({
    enabled: false,
    enforceOrgWide: false,
  });

  // Validation Errors
  const [errors, setErrors] = useState({});

  // Upload states
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  const [bannerUploadProgress, setBannerUploadProgress] = useState(0);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageType, setEditingImageType] = useState(null); // 'logo' or 'banner'
  const [editingImageUrl, setEditingImageUrl] = useState("");
  const [showLogoDropZone, setShowLogoDropZone] = useState(false);
  const [showBannerDropZone, setShowBannerDropZone] = useState(false);
  const [, setLogoFile] = useState(null);
  const [, setBannerFile] = useState(null);

  // Industry options
  const industryOptions = [
    "Technology & Software",
    "Education & Academics",
    "Healthcare & Life Sciences",
    "Financial Services",
    "Marketing & Advertising",
    "Non-Profit & Community",
    "Media & Entertainment",
    "Professional Services",
    "Real Estate",
    "Retail & E-commerce",
    "Manufacturing",
    "Other",
  ];

  // File upload handlers
  const handleLogoUpload = useCallback(
    async (file) => {
      if (!file) return;

      // Validate file
      const validTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        toast.error(
          "Please upload a valid image file (JPEG, PNG, GIF, WebP, or SVG)",
        );
        return;
      }

      if (file.size > maxSize) {
        toast.error(
          `File size exceeds 5MB limit. Current: ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
        );
        return;
      }

      setLogoFile(file);
      setUploadingLogo(true);
      setLogoUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("logo", file);
        formData.append("organizationId", metadata._id);

        // Simulate upload progress
        const interval = setInterval(() => {
          setLogoUploadProgress((prev) => {
            const newProgress = prev + Math.random() * 8;
            if (newProgress >= 90) {
              clearInterval(interval);
              return 90;
            }
            return Math.min(newProgress, 90);
          });
        }, 150);

        // Upload to server
        const response = await organizationApi.uploadOrganizationLogo(
          metadata._id,
          formData,
        );

        clearInterval(interval);
        setLogoUploadProgress(100);

        if (response.data.success) {
          const logoUrl = response.data.data.logoUrl || response.data.data.url;
          setFormData((prev) => ({ ...prev, logo: logoUrl }));
          toast.success("Logo uploaded successfully!");

          // Reset logo file
          setLogoFile(null);

          // Close drop zone
          setShowLogoDropZone(false);
        } else {
          throw new Error(response.data.message || "Failed to upload logo");
        }
      } catch (error) {
        console.error("Logo upload error:", error);
        toast.error(
          error.message || "Failed to upload logo. Please try again.",
        );
      } finally {
        setUploadingLogo(false);
        setTimeout(() => setLogoUploadProgress(0), 1500);
      }
    },
    [metadata._id],
  );

  const handleBannerUpload = useCallback(
    async (file) => {
      if (!file) return;

      // Validate file
      const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      const maxSize = 10 * 1024 * 1024; // 10MB for banners

      if (!validTypes.includes(file.type)) {
        toast.error(
          "Please upload a valid image file (JPEG, PNG, GIF, or WebP)",
        );
        return;
      }

      if (file.size > maxSize) {
        toast.error(
          `File size exceeds 10MB limit. Current: ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
        );
        return;
      }

      setBannerFile(file);
      setUploadingBanner(true);
      setBannerUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append("banner", file);
        formData.append("organizationId", metadata._id);

        // Simulate upload progress
        const interval = setInterval(() => {
          setBannerUploadProgress((prev) => {
            const newProgress = prev + Math.random() * 8;
            if (newProgress >= 90) {
              clearInterval(interval);
              return 90;
            }
            return Math.min(newProgress, 90);
          });
        }, 150);

        // Upload to server
        const response = await organizationApi.uploadOrganizationBanner(
          metadata._id,
          formData,
        );

        clearInterval(interval);
        setBannerUploadProgress(100);

        if (response.data.success) {
          const bannerUrl =
            response.data.data.bannerUrl || response.data.data.url;
          setFormData((prev) => ({ ...prev, bannerUrl }));
          toast.success("Banner uploaded successfully!");

          // Reset banner file
          setBannerFile(null);

          // Close drop zone
          setShowBannerDropZone(false);
        } else {
          throw new Error(response.data.message || "Failed to upload banner");
        }
      } catch (error) {
        console.error("Banner upload error:", error);
        toast.error(
          error.message || "Failed to upload banner. Please try again.",
        );
      } finally {
        setUploadingBanner(false);
        setTimeout(() => setBannerUploadProgress(0), 1500);
      }
    },
    [metadata._id],
  );

  // Image editing handlers
  const handleEditImage = useCallback((type, imageUrl) => {
    setEditingImageType(type);
    setEditingImageUrl(imageUrl);
    setShowImageEditor(true);
  }, []);

  const handleImageEditorSave = useCallback(
    async (editedImageDataUrl) => {
      try {
        // Convert data URL to file
        const response = await fetch(editedImageDataUrl);
        const blob = await response.blob();
        const file = new File([blob], `edited-${editingImageType}.png`, {
          type: "image/png",
        });

        // Upload based on type
        if (editingImageType === "logo") {
          await handleLogoUpload(file);
        } else if (editingImageType === "banner") {
          await handleBannerUpload(file);
        }

        setShowImageEditor(false);
        setEditingImageType(null);
        setEditingImageUrl("");
      } catch (error) {
        console.error("Error saving edited image:", error);
        toast.error("Failed to save edited image");
      }
    },
    [editingImageType, handleLogoUpload, handleBannerUpload],
  );

  // Remove image handlers
  const handleRemoveLogo = useCallback(() => {
    setFormData((prev) => ({ ...prev, logo: "" }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.logo;
      return next;
    });
    toast.info("Logo removed");
  }, []);

  const handleRemoveBanner = useCallback(() => {
    setFormData((prev) => ({ ...prev, bannerUrl: "" }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.bannerUrl;
      return next;
    });
    toast.info("Banner removed");
  }, []);

  // Download image handler
  const handleDownloadImage = useCallback((imageUrl, fileName = "image") => {
    try {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Image downloaded");
    } catch (error) {
      console.error("Error downloading image:", error);
      toast.error("Failed to download image");
    }
  }, []);

  // Fetch organization settings
  const fetchOrgSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await organizationApi.getOrganizationSettings();

      if (data.success && data.organization) {
        const org = data.organization;
        const loadedForm = {
          name: org.name || "",
          description: org.description || "",
          about: org.about || "",
          website: org.website || "",
          contactEmail: org.contactEmail || "",
          industry: org.industry || "",
          location: org.location || "",
          logo: org.logoUrl || org.logo || "",
          bannerUrl: org.bannerUrl || "",
          visibility: org.visibility || "private",
          joinPolicy: org.joinPolicy || "open",
        };

        setFormData(loadedForm);
        setInitialData(loadedForm);

        setMetadata({
          _id: org._id || "",
          slug: org.slug || "",
          createdAt: org.createdAt || null,
          updatedAt: org.updatedAt || null,
          owner: org.owner || null,
          memberCount: org.memberCount || 0,
        });

        setE2eeSettings(
          org.e2eeSettings || { enabled: false, enforceOrgWide: false },
        );

        setUserRole(data.userRole || "member");
        setCanEdit(data.canEdit !== undefined ? data.canEdit : false);
      } else {
        toast.error("Failed to load organization settings.");
      }
    } catch (error) {
      console.error("Error fetching organization settings:", error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Failed to load organization settings.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSaveE2eeSettings = useCallback(
    async (updatedE2ee) => {
      if (!metadata._id) return;
      const { data } = await organizationApi.updateOrganizationSettings(
        metadata._id,
        {
          e2eeSettings: updatedE2ee,
        },
      );
      if (data?.success) {
        setE2eeSettings(data.organization?.e2eeSettings || updatedE2ee);
      }
    },
    [metadata._id],
  );

  useEffect(() => {
    fetchOrgSettings();
  }, [fetchOrgSettings]);

  // Detect unsaved changes (isDirty)
  const isDirty =
    initialData && JSON.stringify(initialData) !== JSON.stringify(formData);

  // Real-time client-side field validation
  const validateField = useCallback(
    (field, value) => {
      let newErrors = { ...errors };

      switch (field) {
        case "name":
          if (!value.trim()) {
            newErrors.name = "Organization name is required.";
          } else if (value.trim().length > 100) {
            newErrors.name = "Organization name cannot exceed 100 characters.";
          } else {
            delete newErrors.name;
          }
          break;

        case "description":
          if (value && value.length > 500) {
            newErrors.description =
              "Short description cannot exceed 500 characters.";
          } else {
            delete newErrors.description;
          }
          break;

        case "about":
          if (value && value.length > 2000) {
            newErrors.about = "About bio cannot exceed 2000 characters.";
          } else {
            delete newErrors.about;
          }
          break;

        case "contactEmail":
          if (value && value.trim()) {
            const emailPattern = /^[^\s@]+@[^\s@.]+\.[^\s@.]+$/;
            if (!emailPattern.test(value.trim())) {
              newErrors.contactEmail = "Please enter a valid email address.";
            } else {
              delete newErrors.contactEmail;
            }
          } else {
            delete newErrors.contactEmail;
          }
          break;

        case "website":
          if (value && value.trim()) {
            const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
            if (!urlPattern.test(value.trim())) {
              newErrors.website =
                "Please enter a valid URL (e.g. https://example.com).";
            } else {
              delete newErrors.website;
            }
          } else {
            delete newErrors.website;
          }
          break;

        case "logo": {
          const logoError = validateImageUrl(value, "Logo URL");
          if (logoError) newErrors.logo = logoError;
          else delete newErrors.logo;
          break;
        }

        case "bannerUrl": {
          const bannerError = validateImageUrl(value, "Banner URL");
          if (bannerError) newErrors.bannerUrl = bannerError;
          else delete newErrors.bannerUrl;
          break;
        }

        default:
          break;
      }

      setErrors(newErrors);
    },
    [errors],
  );

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      validateField(name, value);
    },
    [validateField],
  );

  // Validate entire form before submission
  const validateForm = useCallback(() => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required.";
    } else if (formData.name.trim().length > 100) {
      newErrors.name = "Organization name cannot exceed 100 characters.";
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = "Short description cannot exceed 500 characters.";
    }

    if (formData.about && formData.about.length > 2000) {
      newErrors.about = "About bio cannot exceed 2000 characters.";
    }

    if (formData.contactEmail && formData.contactEmail.trim()) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(formData.contactEmail.trim())) {
        newErrors.contactEmail = "Please enter a valid email address.";
      }
    }

    if (formData.website && formData.website.trim()) {
      const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
      if (!urlPattern.test(formData.website.trim())) {
        newErrors.website =
          "Please enter a valid URL (e.g. https://example.com).";
      }
    }

    const logoError = validateImageUrl(formData.logo, "Logo URL");
    if (logoError) newErrors.logo = logoError;

    const bannerError = validateImageUrl(formData.bannerUrl, "Banner URL");
    if (bannerError) newErrors.bannerUrl = bannerError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Handle Save
  const handleSave = useCallback(
    async (e) => {
      if (e) e.preventDefault();

      if (!canEdit) {
        toast.error(
          "You do not have permission to edit organization settings.",
        );
        return;
      }

      if (!validateForm()) {
        toast.error("Please fix validation errors before saving.");
        return;
      }

      try {
        setSaving(true);
        const { data } = await organizationApi.updateOrganizationSettings(
          metadata._id,
          {
            ...formData,
            logo: formData.logo,
            logoUrl: formData.logo,
            bannerUrl: formData.bannerUrl,
          },
        );

        if (data.success) {
          toast.success("Organization settings updated successfully!");
          setInitialData(formData);

          // Update user context if user's selected org name changed
          if (getUserData) {
            const updatedUser = await getUserData();
            if (updatedUser && setUserData) {
              setUserData(updatedUser);
              localStorage.setItem("userData", JSON.stringify(updatedUser));
            }
          }
        } else {
          toast.error(data.message || "Failed to update settings.");
        }
      } catch (error) {
        console.error("Error updating organization settings:", error);
        const msg =
          error.response?.data?.message ||
          error.message ||
          "Failed to update organization settings.";
        toast.error(msg);
      } finally {
        setSaving(false);
      }
    },
    [canEdit, validateForm, formData, metadata._id, getUserData, setUserData],
  );

  // Reset/Discard changes
  const handleDiscard = useCallback(() => {
    if (initialData) {
      setFormData(initialData);
      setErrors({});
      toast.info("Changes discarded.");
    }
  }, [initialData]);

  // Copy Org ID to clipboard
  const handleCopyId = useCallback(() => {
    if (metadata._id) {
      navigator.clipboard.writeText(metadata._id);
      setCopiedId(true);
      toast.success("Organization ID copied to clipboard!");
      setTimeout(() => setCopiedId(false), 2000);
    }
  }, [metadata._id]);

  // Format date helper
  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const getRoleBadgeStyle = useCallback((role) => {
    switch (role?.toLowerCase()) {
      case "owner":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-700";
      case "admin":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-700";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-700";
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col justify-center items-center p-6">
          <Loader2 className="animate-spin w-10 h-10 text-blue-600 dark:text-blue-400 mb-4" />
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
            Loading Organization Settings...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        {/* Breadcrumbs Navigation */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Dashboard
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <button
            onClick={() => navigate("/organizations")}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
          >
            Organization
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            Settings
          </span>
        </nav>

        {/* Header Title & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-blue-100 dark:bg-blue-900/40 rounded-xl text-blue-600 dark:text-blue-400">
                <Building2 className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Organization Settings
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage information, contact details, and administration settings
              for{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {formData.name || "your organization"}
              </span>
              .
            </p>
          </div>

          {/* Current User Role Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${getRoleBadgeStyle(
                userRole,
              )}`}
            >
              <Shield className="w-3.5 h-3.5" />
              Role: {userRole}
            </span>
          </div>
        </div>

        {/* Read-Only Notice Banner for non-admin/owner */}
        {!canEdit && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-amber-800 dark:text-amber-300">
            <Lock className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">Read-Only Access</h4>
              <p className="text-xs mt-0.5 text-amber-700 dark:text-amber-400">
                You are viewing this organization in read-only mode. Only
                Organization Owners and Administrators have permissions to edit
                organization information.
              </p>
            </div>
          </div>
        )}

        {/* Unsaved Changes Sticky Banner */}
        {isDirty && canEdit && (
          <div className="sticky top-20 z-30 mb-6 p-4 rounded-xl bg-blue-600 text-white shadow-lg flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">
                You have unsaved changes to your organization information.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 bg-white text-blue-600 hover:bg-blue-50 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-8">
          {/* SECTION 1: GENERAL INFORMATION */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  General Information
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Basic details and description of your organization
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Organization Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="e.g. Acme Corporation"
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.name
                      ? "border-red-500 dark:border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {errors.name ? (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.name}
                  </p>
                ) : (
                  <div className="flex justify-end text-[11px] text-slate-400 mt-1">
                    {formData.name.length}/100
                  </div>
                )}
              </div>

              {/* Short Description */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Short Description
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="Brief tagline or summary of the organization (e.g. Leading AI Research Team)"
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.description
                      ? "border-red-500 dark:border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {errors.description ? (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.description}
                  </p>
                ) : (
                  <div className="flex justify-end text-[11px] text-slate-400 mt-1">
                    {formData.description.length}/500
                  </div>
                )}
              </div>

              {/* About / Bio */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  About / Bio
                </label>
                <textarea
                  name="about"
                  rows={4}
                  value={formData.about}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="Detailed information about the organization's mission, goals, background, or overview..."
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.about
                      ? "border-red-500 dark:border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed resize-y`}
                />
                {errors.about ? (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.about}
                  </p>
                ) : (
                  <div className="flex justify-end text-[11px] text-slate-400 mt-1">
                    {formData.about.length}/2000
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION: ORGANIZATION BRANDING - Enhanced with File Upload */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-violet-50 dark:bg-violet-900/30 rounded-xl text-violet-600 dark:text-violet-400">
                <PanelsTopLeft className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Organization Branding
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload logo and banner images with live preview and editing
                  tools
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {/* Logo Upload Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Organization Logo
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Square image recommended (JPEG, PNG, GIF, WebP, SVG) •
                        Max 5MB
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowLogoDropZone(!showLogoDropZone)}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                      >
                        {showLogoDropZone ? (
                          <>
                            <X className="w-3.5 h-3.5" />
                            Close
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            Upload Logo
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Logo Display */}
                <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
                  <div className="flex flex-col items-center gap-3">
                    <OrganizationLogo
                      src={formData.logo}
                      name={formData.name || "Organization"}
                      size="xl"
                    />
                    <div className="flex items-center gap-2">
                      {canEdit && formData.logo && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleEditImage("logo", formData.logo)
                            }
                            className="p-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleDownloadImage(
                                formData.logo,
                                `${formData.name || "organization"}-logo`,
                              )
                            }
                            className="p-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="p-1.5 text-xs bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1 text-red-600 dark:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Logo preview
                    </p>
                  </div>

                  <div className="min-w-0 space-y-3">
                    {/* Logo URL Input */}
                    <label
                      htmlFor="org-logo-url"
                      className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5"
                    >
                      <Link className="w-3.5 h-3.5 text-slate-400" />
                      Logo URL
                    </label>
                    <input
                      id="org-logo-url"
                      type="url"
                      name="logo"
                      value={formData.logo}
                      onChange={handleChange}
                      disabled={!canEdit || saving}
                      placeholder="https://cdn.example.com/logo.png"
                      aria-invalid={Boolean(errors.logo)}
                      aria-describedby={
                        errors.logo ? "org-logo-error" : undefined
                      }
                      className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                        errors.logo
                          ? "border-red-500 focus:ring-red-500"
                          : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                      } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                    />
                    {errors.logo ? (
                      <p
                        id="org-logo-error"
                        className="text-xs text-red-500 flex items-center gap-1"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        {errors.logo}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Enter a URL or use the upload button above. Leave empty
                        to use the default placeholder.
                      </p>
                    )}
                  </div>
                </div>

                {/* Logo Drop Zone */}
                {showLogoDropZone && canEdit && (
                  <div className="mt-4">
                    <FileDropZone
                      onFileSelect={handleLogoUpload}
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      maxSize={5 * 1024 * 1024}
                      disabled={uploadingLogo}
                      label="Drop your logo here or click to browse"
                    />
                    {uploadingLogo && (
                      <UploadProgress
                        progress={logoUploadProgress}
                        isUploading={uploadingLogo}
                        fileName="Uploading logo..."
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Banner Upload Section */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                      <PanelsTopLeft className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Organization Banner
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Wide cover image (3:1 ratio recommended) • JPEG, PNG,
                        GIF, WebP • Max 10MB
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setShowBannerDropZone(!showBannerDropZone)
                        }
                        className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1.5"
                      >
                        {showBannerDropZone ? (
                          <>
                            <X className="w-3.5 h-3.5" />
                            Close
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            Upload Banner
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Banner Display */}
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                    <OrganizationBanner
                      src={formData.bannerUrl}
                      name={formData.name || "Organization"}
                      heightClass="h-36 sm:h-44"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    {canEdit && formData.bannerUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            handleEditImage("banner", formData.bannerUrl)
                          }
                          className="p-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadImage(
                              formData.bannerUrl,
                              `${formData.name || "organization"}-banner`,
                            )
                          }
                          className="p-1.5 text-xs bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveBanner}
                          className="p-1.5 text-xs bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center gap-1 text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remove
                        </button>
                      </>
                    )}
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 ml-auto">
                      Banner preview
                    </p>
                  </div>

                  {/* Banner URL Input */}
                  <label
                    htmlFor="org-banner-url"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5"
                  >
                    <Link className="w-3.5 h-3.5 text-slate-400" />
                    Banner URL
                  </label>
                  <input
                    id="org-banner-url"
                    type="url"
                    name="bannerUrl"
                    value={formData.bannerUrl}
                    onChange={handleChange}
                    disabled={!canEdit || saving}
                    placeholder="https://cdn.example.com/banner.jpg"
                    aria-invalid={Boolean(errors.bannerUrl)}
                    aria-describedby={
                      errors.bannerUrl ? "org-banner-error" : undefined
                    }
                    className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                      errors.bannerUrl
                        ? "border-red-500 focus:ring-red-500"
                        : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                    } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                  />
                  {errors.bannerUrl ? (
                    <p
                      id="org-banner-error"
                      className="text-xs text-red-500 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.bannerUrl}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enter a URL or use the upload button above. Leave empty to
                      use the default gradient.
                    </p>
                  )}
                </div>

                {/* Banner Drop Zone */}
                {showBannerDropZone && canEdit && (
                  <div className="mt-4">
                    <FileDropZone
                      onFileSelect={handleBannerUpload}
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      maxSize={10 * 1024 * 1024}
                      disabled={uploadingBanner}
                      label="Drop your banner here or click to browse"
                    />
                    {uploadingBanner && (
                      <UploadProgress
                        progress={bannerUploadProgress}
                        isUploading={uploadingBanner}
                        fileName="Uploading banner..."
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Image Editor Modal */}
          {showImageEditor && (
            <ImageEditor
              imageUrl={editingImageUrl}
              onSave={handleImageEditorSave}
              onCancel={() => {
                setShowImageEditor(false);
                setEditingImageType(null);
                setEditingImageUrl("");
              }}
              onClose={() => {
                setShowImageEditor(false);
                setEditingImageType(null);
                setEditingImageUrl("");
              }}
            />
          )}

          {/* SECTION 2: CONTACT & LOCATION DETAILS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Contact Details & Metadata
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Website, email, industry, and location attributes
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Website */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Website
                </label>
                <input
                  type="text"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="https://example.com"
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.website
                      ? "border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {errors.website && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.website}
                  </p>
                )}
              </div>

              {/* Contact Email */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Contact Email
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  value={formData.contactEmail}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="contact@organization.com"
                  className={`w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border ${
                    errors.contactEmail
                      ? "border-red-500 focus:ring-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500"
                  } text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed`}
                />
                {errors.contactEmail && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.contactEmail}
                  </p>
                )}
              </div>

              {/* Industry */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  Industry
                </label>
                <select
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <option value="">Select Industry...</option>
                  {industryOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Location
                </label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  disabled={!canEdit || saving}
                  placeholder="City, Country (e.g. San Francisco, CA)"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: READ-ONLY SYSTEM METADATA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                <Info className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Organization Metadata
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Read-only system audit details and identifiers
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Organization ID */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Organization ID
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-200 truncate mr-2">
                    {metadata._id || "N/A"}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                    title="Copy ID"
                  >
                    {copiedId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Organization Slug */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Organization Slug
                </p>
                <p className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-200 mt-1.5 truncate">
                  {metadata.slug || "N/A"}
                </p>
              </div>

              {/* Created Date */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  Created Date
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 mt-1.5">
                  {formatDate(metadata.createdAt)}
                </p>
              </div>

              {/* Owner */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Organization Owner
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 mt-1.5 truncate">
                  {metadata.owner?.name
                    ? `${metadata.owner.name} (${metadata.owner.email})`
                    : "N/A"}
                </p>
              </div>

              {/* Member Count */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-slate-400" />
                    Member Count
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/team-members")}
                    className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    Manage <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                </p>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-200 mt-1.5">
                  {metadata.memberCount} active member(s)
                </p>
              </div>

              {/* Last Updated */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Last Updated
                </p>
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 mt-1.5">
                  {metadata.updatedAt ? formatDate(metadata.updatedAt) : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 4: INTEGRATIONS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                <Blocks className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Integrations
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect third-party tools to extend functionality
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <NotionConnectPanel canEdit={canEdit} />
              <GitHubConnectPanel organizationId={metadata._id} />
              <SlackConnectPanel
                organizationId={metadata._id}
                canEdit={canEdit}
              />
              <IssueTrackerConfig
                provider="jira"
                title="Jira Integration"
                description="Automatically sync Action Items to Jira issues."
                icon={<Blocks className="w-6 h-6 text-blue-600" />}
              />

              <IssueTrackerConfig
                provider="linear"
                title="Linear Integration"
                description="Automatically sync Action Items to Linear issues."
                icon={<Blocks className="w-6 h-6 text-indigo-600" />}
              />
            </div>
          </div>

          {/* Form Submit Bar (for Admin/Owner) */}
          {canEdit && (
            <div className="flex items-center justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={handleDiscard}
                disabled={!isDirty || saving}
                className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Changes
              </button>
              <button
                type="submit"
                disabled={!isDirty || saving}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          )}
        </form>

        {canEdit && metadata._id ? (
          <div className="mt-8 space-y-8">
            <E2eeRolloutPanel
              organizationId={metadata._id}
              e2eeSettings={e2eeSettings}
              canEdit={canEdit}
              onSave={handleSaveE2eeSettings}
            />
            <OrgCustomFieldsSection orgId={metadata._id} />
            <SlaConfigPanel organizationId={metadata._id} />
            <CostConfigSettings canEdit={canEdit} />
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {metadata._id && (
              <E2eeRolloutPanel
                organizationId={metadata._id}
                e2eeSettings={e2eeSettings}
                canEdit={false}
              />
            )}
            <CostConfigSettings canEdit={canEdit} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationSettings;
