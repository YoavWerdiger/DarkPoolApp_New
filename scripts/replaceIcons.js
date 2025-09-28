const fs = require('fs');
const path = require('path');

// פונקציה לסקירה רקורסיבית של קבצים
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      // דלג על node_modules
      if (file !== 'node_modules' && file !== '.git') {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

// פונקציה להחלפת Ionicons
function replaceIonicons(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;

    // בדיקה אם הקובץ מכיל Ionicons
    if (!content.includes('Ionicons') || !content.includes('name=')) {
      return false;
    }

    console.log(`Processing: ${filePath}`);

    // הוספת import ל-Icon
    if (!content.includes("import Icon from") && !content.includes("import { Icon }")) {
      const importMatch = content.match(/import.*from ['"]react['"];?\s*\n/);
      if (importMatch) {
        content = content.replace(
          importMatch[0],
          importMatch[0] + "import Icon from '../components/ui/Icon';\n"
        );
        hasChanges = true;
      }
    }

    // החלפת <Ionicons name="..." size={...} color={...} />
    const ioniconsRegex = /<Ionicons\s+name={?["']([^"']+)["']}?\s+size={?([^}]+)}?\s+color={?([^}]+)}?\s*\/?>/g;
    content = content.replace(ioniconsRegex, (match, name, size, color) => {
      hasChanges = true;
      return `<Icon name="${name}" size={${size}} color={${color}} />`;
    });

    // החלפת <Ionicons name={...} size={...} color={...} />
    const ioniconsVarRegex = /<Ionicons\s+name={([^}]+)}\s+size={([^}]+)}\s+color={([^}]+)}\s*\/?>/g;
    content = content.replace(ioniconsVarRegex, (match, name, size, color) => {
      hasChanges = true;
      return `<Icon name={${name}} size={${size}} color={${color}} />`;
    });

    // החלפת <Ionicons name="..." size={...} color={...} style={...} />
    const ioniconsWithStyleRegex = /<Ionicons\s+name={?["']([^"']+)["']}?\s+size={?([^}]+)}?\s+color={?([^}]+)}?\s+style={?([^}]+)}?\s*\/?>/g;
    content = content.replace(ioniconsWithStyleRegex, (match, name, size, color, style) => {
      hasChanges = true;
      return `<Icon name="${name}" size={${size}} color={${color}} style={${style}} />`;
    });

    if (hasChanges) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// הפעלת הסקריפט
const projectRoot = process.cwd();
const allFiles = getAllFiles(projectRoot);

console.log(`Found ${allFiles.length} files to process...`);

let updatedFiles = 0;
allFiles.forEach(file => {
  if (replaceIonicons(file)) {
    updatedFiles++;
  }
});

console.log(`\n✅ Successfully updated ${updatedFiles} files!`);
