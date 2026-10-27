export type CourseTone = 'lavender' | 'blue' | 'lilac' | 'yellow'
interface CourseBase {
  id: string
  title: string
  shortTitle: string
  category: string
  description: string
  tags: readonly string[]
  tone: CourseTone
  repository: string
}
export interface LocalCourse extends CourseBase {
  mode: 'local'
  overview: string
  start: string
  contentPrefix: string
  manifest: string
}
export interface ExternalCourse extends CourseBase { mode: 'external' }
export type LearningCourse = LocalCourse | ExternalCourse
export const site = {
  name: 'DataTalks Learning',
  description: 'A curious corner of the internet for learning data, machine learning, and AI. Explore DataTalks.Club courses and build something of your own.',
  officialUrl: 'https://datatalks.club/',
  communityUrl: 'https://datatalks.club/slack.html',
  organizationUrl: 'https://github.com/DataTalksClub',
} as const
export const courses: readonly LearningCourse[] = [
  {
    id: 'machine-learning', title: 'Machine Learning Zoomcamp', shortTitle: 'Machine Learning',
    category: 'MODELS & PREDICTIONS', tone: 'lavender', mode: 'local',
    description: 'Turn data into predictions. Get to know the models, then take your first one all the way to production.',
    tags: ['Python', 'Scikit-learn', 'Deep learning'],
    repository: 'https://github.com/DataTalksClub/machine-learning-zoomcamp',
    overview: '/learn/machine-learning', start: '/course/01-intro/01-what-is-ml',
    contentPrefix: 'course/', manifest: 'course-manifest.json',
  },
  {
    id: 'data-engineering', title: 'Data Engineering Zoomcamp', shortTitle: 'Data Engineering',
    category: 'PIPELINES & PLATFORMS', tone: 'blue', mode: 'external',
    description: 'Give data somewhere to go. Build pipelines, work with warehouses, and connect the pieces of a data platform.',
    tags: ['SQL', 'Pipelines', 'Warehouses'],
    repository: 'https://github.com/DataTalksClub/data-engineering-zoomcamp',
  },
  {
    id: 'mlops', title: 'MLOps Zoomcamp', shortTitle: 'MLOps',
    category: 'FROM MODEL TO PRODUCTION', tone: 'lilac', mode: 'external',
    description: 'Help good models stay useful. Explore experiments, deployment, monitoring, and the systems around machine learning.',
    tags: ['Experiments', 'Deployment', 'Monitoring'],
    repository: 'https://github.com/DataTalksClub/mlops-zoomcamp',
  },
  {
    id: 'llm', title: 'LLM Zoomcamp', shortTitle: 'LLM Engineering',
    category: 'LANGUAGE & APPLICATIONS', tone: 'yellow', mode: 'external',
    description: 'Build applications that work with language. Connect models to your knowledge, then evaluate what they give back.',
    tags: ['RAG', 'Retrieval', 'Evaluation'],
    repository: 'https://github.com/DataTalksClub/llm-zoomcamp',
  },
]
export function courseForPath(relativePath: string): LocalCourse | undefined {
  return courses.find((course): course is LocalCourse => course.mode === 'local' && relativePath.startsWith(course.contentPrefix))
}
export const machineLearning = courses.find((course): course is LocalCourse => course.id === 'machine-learning' && course.mode === 'local')!
