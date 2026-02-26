const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const User = require("./models/user");
const verifyToken = require("./middleware/token_verify_middleware");
const bcrypt = require("bcryptjs");
const Course = require("./models/course");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

app.get("/", (req, res) => {
    res.send("SkillNest API Running");
});

app.get("/api/test", (req, res) => {
    console.log("yess");
    res.json({ message: "Backend Connected" });
});

app.get("/api/profile", verifyToken, (req, res) => {
    res.json({ message: "Protected Route Accessed", user: req.user });
});

app.get("/api/my-courses", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .populate("enrolledCourses");

        res.json(user.enrolledCourses);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch enrolled courses" });
    }
});

app.get("/api/courses", async (req, res) => {
    try {
        const courses = await Course.find();
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: "Error fetching courses" });
    }
});

app.post("/api/enroll/:courseId", verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { courseId } = req.params;

        const user = await User.findById(userId);

        if (!user.enrolledCourses.includes(courseId)) {
            user.enrolledCourses.push(courseId);
            await user.save();
        }

        res.json({ message: "Enrolled Successfully" });
    } catch (error) {
        res.status(500).json({ error: "Enrollment failed" });
    }
});

app.post("/api/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            email,
            password: hashedPassword,
        });

        await user.save();

        res.json({ message: "User Registered Successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error registering user" });
    }
});

app.post("/api/add-course", async (req, res) => {
    try {
        const { title, description, price } = req.body;

        const course = new Course({
            title,
            description,
            price,
        });

        await course.save();

        res.json({ message: "Course Added Successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error adding course" });
    }
});

app.post("/api/refresh", (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) return res.status(401).json({ message: "No token" });

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid refresh token" });

        const newAccessToken = jwt.sign(
            { id: user.id },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: "15m" }
        );

        res.json({ accessToken: newAccessToken });
    });
});

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid password" });

        const accessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: "15m" }
        );

        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
        });
    } catch (error) {
        res.status(500).json({ error: "Login error" });
    }
});

app.put("/api/update-course/:id", async (req, res) => {
    try {
        await Course.findByIdAndUpdate(req.params.id, req.body);
        res.json({ message: "Course Updated" });
    } catch (error) {
        res.status(500).json({ error: "Update failed" });
    }
});

// Delete Course
app.delete("/api/delete-course/:id", async (req, res) => {
    try {
        await Course.findByIdAndDelete(req.params.id);
        res.json({ message: "Course Deleted" });
    } catch (error) {
        res.status(500).json({ error: "Delete failed" });
    }
});

app.listen(process.env.PORT, () => {
    console.log("Server running on port 5000");
});