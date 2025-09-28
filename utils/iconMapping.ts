import { 
  ArrowRight, 
  ArrowLeft, 
  X, 
  XCircle, 
  Check, 
  CheckCircle2, 
  User, 
  Users, 
  UserMinus, 
  MessageCircle, 
  ChevronLeft, 
  ChevronRight, 
  ChevronUp, 
  ChevronDown, 
  Star, 
  Clock, 
  Mail, 
  Lock, 
  Settings, 
  LogOut, 
  Camera, 
  Key, 
  Ban, 
  AlertTriangle, 
  Wifi, 
  BarChart3, 
  TrendingUp, 
  Video as VideoIcon, 
  ImageIcon, 
  Music, 
  FileText, 
  File, 
  Trash2, 
  Edit3, 
  Plus, 
  Square, 
  Play, 
  Pause, 
  PlayCircle, 
  Download, 
  Share as ShareIcon, 
  RotateCcw, 
  RefreshCw, 
  Save, 
  Type, 
  Palette, 
  PlusCircle, 
  Bell, 
  BellOff, 
  MoreVertical, 
  EyeOff, 
  Trophy, 
  Phone, 
  Rocket, 
  Mic,
  AtSign
} from 'lucide-react-native';

// Mapping של Ionicons ל-Lucide icons
export const iconMapping: Record<string, any> = {
  // Navigation
  'arrow-forward': ArrowRight,
  'arrow-back': ArrowLeft,
  'chevron-forward': ArrowRight,
  'chevron-back': ChevronLeft,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  
  // Actions
  'close': X,
  'close-circle': XCircle,
  'checkmark': Check,
  'checkmark-circle': CheckCircle2,
  'trash': Trash2,
  'trash-outline': Trash2,
  'add': Plus,
  'add-circle-outline': PlusCircle,
  'refresh': RefreshCw,
  'save': Save,
  
  // User & People
  'person': User,
  'person-outline': User,
  'people': Users,
  'person-remove-outline': UserMinus,
  
  // Communication
  'chatbubble': MessageCircle,
  'chatbubbles': MessageCircle,
  'mail-outline': Mail,
  'call-outline': Phone,
  
  // Security
  'lock-closed': Lock,
  'lock-closed-outline': Lock,
  'key-outline': Key,
  'ban-outline': Ban,
  'warning-outline': AlertTriangle,
  'alert-circle': AlertTriangle,
  
  // Media
  'image': ImageIcon,
  'image-outline': ImageIcon,
  'videocam': VideoIcon,
  'videocam-outline': VideoIcon,
  'musical-notes': Music,
  'document': FileText,
  'document-outline': FileText,
  'document-text-outline': FileText,
  'file': File,
  'mic': Mic,
  'play': Play,
  'pause': Pause,
  'play-circle': PlayCircle,
  'download': Download,
  'download-outline': Download,
  
  // UI Elements
  'star': Star,
  'time': Clock,
  'time-outline': Clock,
  'settings': Settings,
  'log-out-outline': LogOut,
  'camera': Camera,
  'camera-outline': Camera,
  'wifi': Wifi,
  'bar-chart': BarChart3,
  'bar-chart-outline': BarChart3,
  'trending-up-outline': TrendingUp,
  'color-palette': Palette,
  'notifications': Bell,
  'notifications-off': BellOff,
  'ellipsis-vertical': MoreVertical,
  'eye-off-outline': EyeOff,
  'trophy': Trophy,
  'rocket-outline': Rocket,
  'at': AtSign,
  
  // Share & Actions
  'share': ShareIcon,
  'share-outline': ShareIcon,
  'arrow-redo': RotateCcw,
  'arrow-redo-outline': RotateCcw,
  'text': Type,
  'pencil-outline': Edit3,
  'create-outline': Edit3,
  'stop': Square,
  
  // Status
  'checkmark-circle-outline': CheckCircle2,
  'close-outline': X,
  'close-circle-outline': XCircle,
};

// פונקציה לקבלת אייקון
export const getIcon = (ioniconName: string, size: number = 24, color: string = '#000', strokeWidth: number = 2) => {
  const IconComponent = iconMapping[ioniconName];
  if (IconComponent) {
    return IconComponent({ size, color, strokeWidth });
  }
  
  // אם לא נמצא, החזר אייקון ברירת מחדל
  console.warn(`Icon not found: ${ioniconName}`);
  return X({ size, color, strokeWidth });
};
