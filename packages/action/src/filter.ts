import { ChangedFile, AnalysisConfig } from '@vibesafe/shared';
import micromatch from 'micromatch';

export function filterFiles(files: ChangedFile[], config: AnalysisConfig): ChangedFile[] {
  return files
    .filter(f => !micromatch([f.filename], config.ignore_paths).length)
    .slice(0, config.max_files);
}
