import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCheck2,
  GraduationCap,
  User,
  Briefcase,
  Award,
  FolderClosed,
  Cloud,
  ShieldCheck,
} from 'lucide-react';
import { DocumentCategory, DocumentFileType } from '../types/docucloud';

export const DocucloudLogo: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({
  size = 'md',
}) => {
  const dims =
    size === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : size === 'lg'
      ? 'w-16 h-16 rounded-2xl'
      : 'w-11 h-11 rounded-xl';
  const iconDims =
    size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';

  return (
    <div
      className={`${dims} bg-gradient-to-br from-[#2563EB] to-[#1E3A8A] text-white flex items-center justify-center shadow-sm relative shrink-0`}
    >
      <Cloud className={iconDims} />
      {size === 'lg' && (
        <span className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[#16A34A] text-white border-2 border-white flex items-center justify-center">
          <ShieldCheck className="w-3.5 h-3.5" />
        </span>
      )}
    </div>
  );
};

export const FileTypeBadgeIcon: React.FC<{
  type: DocumentFileType;
  size?: 'sm' | 'md' | 'lg';
}> = ({ type, size = 'md' }) => {
  const boxClass =
    size === 'sm'
      ? 'w-9 h-9 rounded-lg'
      : size === 'lg'
      ? 'w-12 h-12 rounded-xl'
      : 'w-11 h-11 rounded-xl';
  const iconClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  switch (type) {
    case 'pdf':
      return (
        <div
          className={`${boxClass} bg-red-50 text-[#DC2626] flex items-center justify-center shrink-0`}
        >
          <FileText className={iconClass} />
        </div>
      );
    case 'image':
      return (
        <div
          className={`${boxClass} bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center shrink-0`}
        >
          <ImageIcon className={iconClass} />
        </div>
      );
    case 'xls':
      return (
        <div
          className={`${boxClass} bg-green-50 text-[#16A34A] flex items-center justify-center shrink-0`}
        >
          <FileSpreadsheet className={iconClass} />
        </div>
      );
    case 'doc':
    default:
      return (
        <div
          className={`${boxClass} bg-slate-100 text-[#1E3A8A] flex items-center justify-center shrink-0`}
        >
          <FileCheck2 className={iconClass} />
        </div>
      );
  }
};

export const CategoryIcon: React.FC<{
  category: DocumentCategory;
  className?: string;
}> = ({ category, className = 'w-5 h-5' }) => {
  switch (category) {
    case 'Académicos':
      return <GraduationCap className={className} />;
    case 'Personales':
      return <User className={className} />;
    case 'Trabajo':
      return <Briefcase className={className} />;
    case 'Certificados':
      return <Award className={className} />;
    case 'Otros':
    default:
      return <FolderClosed className={className} />;
  }
};
