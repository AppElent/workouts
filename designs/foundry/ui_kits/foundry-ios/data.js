window.FOUNDRY_DATA = {
  recent: [
    { id: "s1", name: "Push day", when: "Mon 14 Sep", duration: "48 min" },
    { id: "s2", name: "Leg day", when: "Sat 12 Sep", duration: "62 min" },
    { id: "s3", name: "Free session", when: "Thu 10 Sep", duration: "31 min" },
    { id: "s4", name: "Pull day", when: "Tue 8 Sep", duration: "45 min" },
  ],
  routines: [
    { id: "r1", name: "Push day", exercises: [
      { name: "Bench press", sets: 4, reps: 8 },
      { name: "Incline DB press", sets: 3, reps: 10 },
      { name: "Lateral raise", sets: 3, reps: 15 },
      { name: "Triceps pushdown", sets: 3, reps: 12 },
    ] },
    { id: "r2", name: "Leg day", exercises: [
      { name: "Back squat", sets: 5, reps: 5 },
      { name: "Romanian deadlift", sets: 3, reps: 8 },
      { name: "Leg press", sets: 3, reps: 12 },
      { name: "Standing calf raise", sets: 4, reps: 15 },
      { name: "Hanging leg raise", sets: 3, reps: 12 },
    ] },
  ],
  exercises: [
    { id: "e1", name: "Back squat", category: "compound", equipment: "barbell", isDefault: true },
    { id: "e2", name: "Bench press", category: "compound", equipment: "barbell", isDefault: true },
    { id: "e3", name: "Deadlift", category: "compound", equipment: "barbell", isDefault: true },
    { id: "e4", name: "Incline DB press", category: "compound", equipment: "dumbbell", isDefault: true },
    { id: "e5", name: "Lateral raise", category: "isolation", equipment: "dumbbell", isDefault: true },
    { id: "e6", name: "Triceps pushdown", category: "isolation", equipment: "cable", isDefault: true },
    { id: "e7", name: "Zercher squat", category: "compound", equipment: "barbell", isDefault: false },
  ],
  sets: [
    { n: 1, type: "warmup", weight: 40, reps: 10 },
    { n: 2, type: "working", weight: 60, reps: 8 },
  ],
  diary: {
    breakfast: [
      { id: "d1", name: "Skyr, plain", serving: "250 g", kcal: 158 },
      { id: "d2", name: "Oats", serving: "80 g", kcal: 304 },
    ],
    lunch: [{ id: "d3", name: "Chicken thigh, grilled", serving: "180 g", kcal: 326 }],
    dinner: [],
    snacks: [{ id: "d4", name: "Banana", serving: "1 medium", kcal: 105 }],
  },
};
