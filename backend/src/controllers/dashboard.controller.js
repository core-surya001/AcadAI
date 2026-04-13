'use strict';

const StudentModel = require('../models/student.model');

/**
 * GET /dashboard/stats
 * Returns aggregate stats for the dashboard overview cards.
 */
exports.getStats = async (req, res, next) => {
  try {
    const stats = await StudentModel.getStats();

    res.json({
      success: true,
      data   : {
        totalStudents      : parseInt(stats.total_students),
        totalStudentsTrend : 4.2,                              // placeholder — wire to time-series later
        averageScore       : parseFloat(stats.average_score),
        averageScoreTrend  : 1.8,
        atRiskStudents     : parseInt(stats.at_risk_students),
        atRiskNew          : parseInt(stats.high_risk_count),
        avgAttendance      : parseFloat(stats.avg_attendance),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /dashboard/class-distribution
 * Returns student counts grouped by major.
 */
exports.getClassDistribution = async (req, res, next) => {
  try {
    const COLORS = [
      'bg-indigo-500','bg-indigo-400','bg-indigo-300',
      'bg-purple-400','bg-purple-300','bg-amber-400',
    ];

    const rows = await StudentModel.getClassDistribution();

    const data = rows.map((row, i) => ({
      name    : row.name,
      students: row.students,
      percent : row.percent,
      color   : COLORS[i % COLORS.length],
    }));

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};
