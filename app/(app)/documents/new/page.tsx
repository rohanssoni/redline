import type { Metadata } from 'next';
import { UploadStep } from './upload-step';

export const metadata: Metadata = { title: 'New document — Redline' };

export default function NewDocumentPage() {
  return <UploadStep />;
}
