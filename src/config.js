// ONE place to manage subjects. To add a subject, copy a block and give it a unique key.
// core: true  -> always tracked for every student (used for balance suggestions)
// core: false -> only appears for a student once a session has been logged for it
// Each subject needs exactly 5 level descriptions (Level 1 = beginner, Level 5 = most advanced).
// No database change is needed when you add or rename subjects.
export const DEFAULT_LEVELS = ['1 - Beginner', '2 - Developing', '3 - Intermediate', '4 - Proficient', '5 - Mastery']

export const SUBJECTS = [
  { key: 'english', label: 'English', core: true, color: '#4c6ef5',
    levels: ['1 - Alphabets and sounds', '2 - Simple words', '3 - Short sentences', '4 - Reading paragraphs', '5 - Conversation and writing'] },
  { key: 'math', label: 'Maths', core: true, color: '#e8590c',
    levels: ['1 - Numbers 1 to 100', '2 - Addition and subtraction', '3 - Multiplication tables', '4 - Division', '5 - Fractions and word problems'] },
  { key: 'geography', label: 'Geography', core: false, color: '#2f9e44',
    levels: ['1 - Directions and simple maps', '2 - Continents and oceans', '3 - India: states and capitals', '4 - Climate and landforms', '5 - Map reading and projects'] },
  { key: 'science', label: 'Science', core: false, color: '#9c36b5',
    levels: ['1 - Living and non-living things', '2 - Plants and animals', '3 - Human body and health', '4 - Matter and energy', '5 - Simple experiments'] },
  { key: 'hindi', label: 'Hindi', core: false, color: '#f08c00',
    levels: ['1 - Varnamala', '2 - Simple words', '3 - Short sentences', '4 - Reading paragraphs', '5 - Writing and conversation'] },
  { key: 'computer', label: 'Computer Basics', core: false, color: '#1098ad',
    levels: ['1 - Parts of a computer', '2 - Mouse and keyboard', '3 - Typing and drawing', '4 - Internet basics', '5 - Documents and email'] },
]
