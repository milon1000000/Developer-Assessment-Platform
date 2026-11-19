export interface IAdminDashboardOverview {
	counts: {
		totalUsers: number;
		totalDevelopers: number;
		totalRecruiters: number;
		totalAssessments: number;
		totalQuestions: number;
		totalInvites: number;
		totalSubmissions: number;
		completedSubmissions: number;
		passedSubmissions: number;
		disqualifiedSubmissions: number;
		overallPassRate: number;
	};
	recentActivity: {
		recentSubmissions: any[];
		recentAssessments: any[];
		recentUsers: any[];
	};
}

export interface IRecruiterDashboardOverview {
	counts: {
		totalAssessments: number;
		activeAssessments: number;
		totalInvites: number;
		pendingInvites: number;
		acceptedInvites: number;
		totalSubmissions: number;
		completedSubmissions: number;
		passedCandidates: number;
		failedCandidates: number;
		disqualifiedCandidates: number;
		passRate: number;
		averageScore: number;
	};
	recentSubmissions: any[];
	topAssessments: any[];
}

export interface IDeveloperDashboardOverview {
	counts: {
		totalAttempted: number;
		completed: number;
		passed: number;
		failed: number;
		inProgress: number;
		passRate: number;
		averageScore: number;
	};
	recentSubmissions: any[];
}
