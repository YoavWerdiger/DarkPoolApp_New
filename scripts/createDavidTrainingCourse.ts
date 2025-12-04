// סקריפט ליצירת קורס הכשרה של דוד אריאל
// להרצה: npx ts-node scripts/createDavidTrainingCourse.ts

import { courseService } from '../services/courseService';

async function createCourse() {
  console.log('🚀 Starting to create David Training course...');
  
  try {
    const result = await courseService.createDavidTrainingCourse();
    
    if (result) {
      console.log('✅ Course created successfully!');
      console.log('📚 Course ID: david-training-course');
      console.log('📝 Total lessons: 40');
    } else {
      console.error('❌ Failed to create course');
    }
  } catch (error) {
    console.error('❌ Error creating course:', error);
  }
}

createCourse();

