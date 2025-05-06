require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");
const ExcelJS = require('exceljs');

const app = express();

app.use(cors({
  origin: "*", // или указать точный домен, с которого разрешены запросы
}));
app.use(express.json());

const PORT = process.env.PORT || 6000;
const uri = "there was a link here";

// Подключаемся к MongoDB при запуске сервера
mongoose.connect(uri)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB connection error:", err));

const UserSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  password: String
});

const TestSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  date: Date,
  fullName: String,
  gender: String,
  age: Number,
  height: Number,
  weight: Number,
  vitalCapacity: Number,
  wristStrength: Number,
  hearthRate: String,
  bloodPressure: String,
  score: String,
  status: String,
});

const User = mongoose.model("User", UserSchema);
const Test = mongoose.model("Test", TestSchema);

app.post("/register", async (req, res) => {
  try {
    const { fullName, phone, password } = req.body;
    console.log(req.body, '@@@');

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ message: "Valid password is required" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ fullName, phone, password: hashedPassword });
    await newUser.save();

    res.json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Логин с проверкой хеша
app.post("/login", async (req, res) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials", error: true });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials", error: true });
    }

    res.json({ message: "Login successful", userId: user._id, error: false });
    console.log({ message: "Login successful", userId: user._id, error: false });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error", error: true });
  }
});


const calculateHealthScore = ({ gender, height, weight, vitalCapacity, wristStrength,
                                hearthRate, bloodPressure, recoveryTime }) => {
  // 1. Индекс массы тела (ИМТ)
  const bmi = weight / Math.pow(height / 100, 2); // kg / m^2
  let bmiScore = 0;
  if (gender === "male") {
    // Для мужчин
    if (bmi <= 18.9) bmiScore = -2;
    else if (bmi <= 20.0) bmiScore = -1;
    else if (bmi <= 25.0) bmiScore = 0;
    else if (bmi <= 28.0) bmiScore = -1;
    else bmiScore = -2;
  } else {
    // Для женщин
    if (bmi <= 16.9) bmiScore = -2;
    else if (bmi <= 18.6) bmiScore = -1;
    else if (bmi <= 23.8) bmiScore = 0;
    else if (bmi <= 26.0) bmiScore = -1;
    else bmiScore = -2;
  }

  // 2. Жизненный индекс (ЖЕЛ / масса тела)
  const lifeIndex = vitalCapacity / weight; // мл / кг
  let lifeIndexScore = 0;
  if (gender === "male") {
    // Для мужчин
    if (lifeIndex <= 50) lifeIndexScore = -1;
    else if (lifeIndex <= 55) lifeIndexScore = 0;
    else if (lifeIndex <= 60) lifeIndexScore = 1;
    else if (lifeIndex <= 65) lifeIndexScore = 2;
    else lifeIndexScore = 3;
  } else {
    // Для женщин
    if (lifeIndex <= 40) lifeIndexScore = -1;
    else if (lifeIndex <= 45) lifeIndexScore = 0;
    else if (lifeIndex <= 50) lifeIndexScore = 1;
    else if (lifeIndex <= 56) lifeIndexScore = 2;
    else lifeIndexScore = 3;
  }

  // 3. Силовой индекс (сила кисти / масса тела)
  const strengthIndex = (wristStrength / weight) * 100; // %
  let strengthIndexScore = 0;
  if (gender === "male") {
    // Для мужчин
    if (strengthIndex <= 60) strengthIndexScore = -1;
    else if (strengthIndex <= 65) strengthIndexScore = 0;
    else if (strengthIndex <= 70) strengthIndexScore = 1;
    else if (strengthIndex <= 80) strengthIndexScore = 2;
    else strengthIndexScore = 3;
  } else {
    // Для женщин
    if (strengthIndex <= 40) strengthIndexScore = -1;
    else if (strengthIndex <= 50) strengthIndexScore = 0;
    else if (strengthIndex <= 55) strengthIndexScore = 1;
    else if (strengthIndex <= 60) strengthIndexScore = 2;
    else strengthIndexScore = 3;
  }

  // 4. Индекс Робинсона (ЧСС * АД / 100)
  const systolicBP = bloodPressure.includes("/") ?
    parseInt(bloodPressure.split("/")[0], 10) :
    parseInt(bloodPressure, 10);
  const robinsonIndex = hearthRate * systolicBP / 100;
  let robinsonScore = 0;
  if (robinsonIndex >= 111) robinsonScore = -2;
  else if (robinsonIndex >= 95) robinsonScore = -1;
  else if (robinsonIndex >= 85) robinsonScore = 0;
  else if (robinsonIndex >= 70) robinsonScore = 3;
  else robinsonScore = 5;

  // 5. Время восстановления ЧСС после приседаний
  let recoveryScore = 0;
  if (recoveryTime >= 180) recoveryScore = -2;
  else if (recoveryTime >= 120) recoveryScore = 1;
  else if (recoveryTime >= 90) recoveryScore = 3;
  else if (recoveryTime >= 60) recoveryScore = 5;
  else recoveryScore = 7;

  // Суммируем баллы
  let totalScore = bmiScore + lifeIndexScore + strengthIndexScore
    + robinsonScore + recoveryScore;

  // Оценка уровня здоровья
  let healthLevel = "";
  if (totalScore <= 3) healthLevel = "Низкий";
  else if (totalScore <= 6) healthLevel = "Ниже среднего";
  else if (totalScore <= 11) healthLevel = "Средний";
  else if (totalScore <= 15) healthLevel = "Выше среднего";
  else healthLevel = "Высокий";

  return { totalScore, healthLevel };
};


// Добавляем тест с расчётом оценки
app.post("/add-test", async (req, res) => {
  try {
    const { userId, age, height, weight, vitalCapacity, wristStrength,
      hearthRate, bloodPressure, fullName, gender, recoveryTime } = req.body;
    // Рассчитываем балл и статус
    const { totalScore, healthLevel } = calculateHealthScore({
      gender,
      age,
      height,
      weight,
      vitalCapacity,
      wristStrength,
      hearthRate,
      bloodPressure,
      recoveryTime,
    });

    console.log(totalScore, '@@@')
    const newTest = new Test({
      userId,
      date: new Date(),
      fullName,
      gender,
      age,
      height,
      weight,
      vitalCapacity,
      wristStrength,
      hearthRate: hearthRate,
      bloodPressure,
      score: totalScore,
      status: healthLevel,
    });

    await newTest.save();
    res.json({ message: "Test saved successfully", score: totalScore, status: healthLevel });
  } catch (error) {
    console.error("Ошибка при сохранении теста:", error);
    res.status(500).json({ error: "Ошибка при сохранении теста" });
  }
});

// Получаем тесты пользователя
app.get("/tests/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const objectId = new mongoose.Types.ObjectId(userId);

    const tests = await Test.find({ userId: objectId });

    res.json(tests);
  } catch (error) {
    console.error("Ошибка при получении тестов:", error);
    res.status(500).json({ error: "Ошибка при получении тестов" });
  }
});

// Получаем профиль пользователя
app.get("/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId);
  const testCount = await Test.countDocuments({ userId });
  res.json({ fullName: user.fullName, phone: user.phone, testCount });
});

// Удалить тест по ID
app.delete("/delete-test/:testId", async (req, res) => {
  try {
    const { testId } = req.params;
    console.log(req.params, '@@@')
    const objectTestId = new mongoose.Types.ObjectId(testId);

    const deletedTest = await Test.findByIdAndDelete(objectTestId);

    if (!deletedTest) {
      return res.status(404).json({ message: "Test not found", error: true });
    }

    res.json({ message: "Test deleted successfully", error: false });
  } catch (error) {
    console.error("Error deleting test:", error);
    res.status(500).json({  error: true });
  }
});

app.get('/download-tests/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`Downloading tests for userId: ${userId}`);

    const tests = await Test.find({ userId });
    console.log(`Found ${tests.length} tests for userId: ${userId}`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tests');

    worksheet.columns = [
      { header: 'ФИО', key: 'fullName', width: 20 },
      { header: 'Пол', key: 'gender', width: 10 },
      { header: 'Возраст', key: 'age', width: 10 },
      { header: 'Рост (см)', key: 'height', width: 12 },
      { header: 'Вес (кг)', key: 'weight', width: 12 },
      { header: 'ЖЕЛ (мл)', key: 'vitalCapacity', width: 12 },
      { header: 'Сила кисти (кг)', key: 'wristStrength', width: 15 },
      { header: 'Пульс (уд/мин)', key: 'hearthRate', width: 15 },
      { header: 'Давление', key: 'bloodPressure', width: 12 },
      { header: 'Баллы', key: 'score', width: 10 },
      { header: 'Статус', key: 'status', width: 15 },
      { header: 'Дата', key: 'date', width: 15 }
    ];

    tests.forEach(test => {
      worksheet.addRow({
        fullName: test.fullName,
        gender: test.gender,
        age: test.age,
        height: test.height,
        weight: test.weight,
        vitalCapacity: test.vitalCapacity,
        wristStrength: test.wristStrength,
        hearthRate: test.hearthRate,
        bloodPressure: test.bloodPressure,
        score: test.score,
        status: test.status,
        date: test.date.toLocaleDateString(),
      });
    });
    worksheet.autoFilter = {
      from: 'A1',
      to: 'L1'
    };

    const statusCounts = tests.reduce((acc, test) => {
      acc[test.status] = (acc[test.status] || 0) + 1;
      return acc;
    }, {});

    const possibleStatuses = ["Низкий", "Ниже среднего", "Средний", "Выше среднего", "Высокий"];
    possibleStatuses.forEach(status => {
      if (!statusCounts[status]) {
        statusCounts[status] = 0;
      }
    });

    worksheet.addRow([]);

    worksheet.addRow(['Итоги по уровням здоровья:']);

    for (const status of possibleStatuses) {
      worksheet.addRow([status, statusCounts[status]]);
    }
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="tests.xlsx"'
    );

    await workbook.xlsx.write(res);
    console.log(`Excel file sent successfully for userId: ${userId}`);
    res.end();
  } catch (error) {
    console.error('Ошибка при создании Excel:', error);
    res.status(500).json({ message: 'Ошибка при создании Excel файла' });
  }
});


// Запускаем сервер
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
