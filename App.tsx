
import React, { useState, useEffect, useRef } from 'react';
import { Section, Profile, INITIAL_PROFILE, ChatPreferences, INITIAL_CHAT_PREFERENCES } from './types';
import { REFLECTION_PROMPTS, SECTION_LEVELS } from './constants';
import { useProfile } from './context/ProfileContext';
import IdentityForm from './components/IdentityForm';
import AcademicForm from './components/AcademicForm';
import ExpertiseForm from './components/ExpertiseForm';
import MilestoneForm from './components/MilestoneForm';
import ReflectionForm from './components/ReflectionForm';
import ReviewPage from './components/ReviewPage';
import SectionSummary from './components/SectionSummary';
import EmojiBurst from './components/EmojiBurst';
import ChatSettings from './components/ChatSettings';
import { Auth } from './components/Auth';
import AvatarProgress from './components/AvatarProgress';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

const VIGYAN_SHAALA_LOGO = '/log.png';
const STORAGE_KEY = 'vs_reflection_profile';
const CHAT_PREFS_KEY = 'vs_chat_preferences';
const LEVEL_1_SECTIONS: Section[] = [Section.BASIC, Section.ACADEMIC, Section.SKILLS, Section.MILESTONES];
const LEVEL_2_SECTIONS: Section[] = [Section.REFLECTIONS, Section.REVIEW];
const JOURNEY_STEPS: Section[] = [Section.BASIC, Section.ACADEMIC, Section.SKILLS, Section.MILESTONES, Section.REFLECTIONS];

const MILESTONE_EMOJIS: Record<string, string[]> = {
  [Section.BASIC]: ['👤', '✨', '👋', '✅'],
  [Section.ACADEMIC]: ['🎓', '📚', '🧪', '🌟'],
  [Section.SKILLS]: ['🛠️', '💻', '🚀', '🔥'],
  [Section.MILESTONES]: ['🏆', '🏗️', '📜', '✨'],
  [Section.REFLECTIONS]: ['🧠', '💡', '💎', '🌈'],
  [Section.REVIEW]: ['🏁', '🏆', '🎊', '✨']
};

const mergeProfileWithDefaults = (data: any): Profile => {
  if (!data) return INITIAL_PROFILE;
  return {
    ...INITIAL_PROFILE,
    ...data,
    aspirations: { 
      ...INITIAL_PROFILE.aspirations, 
      ...(data.aspirations || {}) 
    },
    reflections: { 
      ...INITIAL_PROFILE.reflections, 
      ...(data.reflections || {}) 
    },
    subjectSkills: Array.isArray(data.subjectSkills) ? data.subjectSkills : [],
    toolSkills: Array.isArray(data.toolSkills) ? data.toolSkills : [],
    aiSkills: Array.isArray(data.aiSkills) ? data.aiSkills : [],
    professionalSkills: Array.isArray(data.professionalSkills) ? data.professionalSkills : [],
        projects: Array.isArray(data.projects) 
      ? data.projects.map((p: any) => {
          if (typeof p === 'string') return { name: p, details: '', isSaved: true };
          return {
            name: p.name || '',
            details: p.details || '',
            isSaved: typeof p.isSaved === 'boolean' ? p.isSaved : true
          };
        })
      : [],
    exams: Array.isArray(data.exams) 
      ? data.exams.map((e: any) => {
          if (typeof e === 'string') return { name: e, status: '', details: '' };
          return {
            name: e.name || '',
            status: e.status || '',
            details: e.details || '',
            customName: e.customName || ''
          };
        }) 
      : [],
    certifications: Array.isArray(data.certifications)
      ? data.certifications.map((c: any) => ({
          name: c.name || '',
          status: c.status || '',
          details: c.details || '',
          customName: c.customName || ''
        }))
      : [],
    internships: Array.isArray(data.internships) ? data.internships : [],
    volunteering: Array.isArray(data.volunteering) ? data.volunteering : [],
    interests: Array.isArray(data.interests) ? data.interests : [],
  };
};


const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);

  const { profile, setProfile, chatPreferences, setChatPreferences } = useProfile();
  const [visibleSections, setVisibleSections] = useState<Section[]>([Section.BASIC]);
  const [isStarted, setIsStarted] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [savedSections, setSavedSections] = useState<Section[]>([]);
  const [showMilestoneBurst, setShowMilestoneBurst] = useState(false);
  const [currentBurstEmojis, setCurrentBurstEmojis] = useState<string[]>(['✨']);
  const [validationErrors, setValidationErrors] = useState<{ section: Section; fields: Record<string, string> } | null>(null);
  const [skipMessage, setSkipMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<{ message: string; section: Section } | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(Section.BASIC);
  const [draftProfile, setDraftProfile] = useState<Profile | null>(null);
  const [selectedLevelCard, setSelectedLevelCard] = useState<'level1' | 'level2' | null>(null);
  const [showLevel2Prompt, setShowLevel2Prompt] = useState(false);
  const [level2PromptHandled, setLevel2PromptHandled] = useState(false);
  const [level2AccessGranted, setLevel2AccessGranted] = useState(false);
  const [reflectionsFocusPulse, setReflectionsFocusPulse] = useState(false);
  const [journeyMessage, setJourneyMessage] = useState<string | null>(null);
  const [xpMessage, setXpMessage] = useState<string | null>(null);
  const [avatarGrowthToast, setAvatarGrowthToast] = useState<string | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previousUnlockedCountRef = useRef(1);
  const previousAvatarStageRef = useRef(1);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setIsAuthenticated(true);
          
          // Auto-start for returning authenticated users
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              handleStart(parsed);
            } catch (e) {
              handleStart();
            }
          } else {
            handleStart();
          }
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (user && user.phone && (!profile.whatsappNumber || profile.whatsappNumber === '9999999999')) {
      setProfile(prev => ({ ...prev, whatsappNumber: user.phone }));
    }
  }, [user, profile.whatsappNumber, setProfile]);

  useEffect(() => {
    const savedPrefs = localStorage.getItem(CHAT_PREFS_KEY);
    if (savedPrefs) {
      setChatPreferences(JSON.parse(savedPrefs));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CHAT_PREFS_KEY, JSON.stringify(chatPreferences));
  }, [chatPreferences]);

  useEffect(() => {
    if (isStarted) {
      window.scrollTo(0, 0);
    }
  }, [isStarted]);

  useEffect(() => {
    if (isStarted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    }
  }, [profile, isStarted]);

  useEffect(() => {
    if (editingSection) {
      const draft = { ...profile };
      if (editingSection === Section.MILESTONES) {
        draft.projects = draft.projects.map(p => ({ ...p, isSaved: true }));
        draft.exams = draft.exams.map(e => ({ ...e, isSaved: true }));
        draft.certifications = draft.certifications.map(c => ({ ...c, isSaved: true }));
      }
      setDraftProfile(draft);
    } else {
      setDraftProfile(null);
    }
  }, [editingSection, profile]);

  const updateProfile = (updates: Partial<Profile>) => {
    const now = new Date().toISOString();
    setProfile(prev => ({ ...prev, ...updates, lastUpdatedAt: now }));
    // Clear errors when user types
    if (validationErrors) setValidationErrors(null);
  };

  const updateDraftProfile = (updates: Partial<Profile>) => {
    setDraftProfile(prev => prev ? ({ ...prev, ...updates }) : null);
    // Clear errors when user types
    if (validationErrors) setValidationErrors(null);
  };

  const handleCancel = () => {
    setDraftProfile(null);
    setEditingSection(null);
    setValidationErrors(null);
  };

  const handleSkip = (section: Section) => {
    // Logic to skip the section
    if (!savedSections.includes(section)) {
      setSavedSections(prev => [...prev, section]);
    }
    setEditingSection(null);
    setValidationErrors(null);
    
    // Auto scroll to next section
    const allSections = [
      ...SECTION_LEVELS.BASELINE,
      ...SECTION_LEVELS.DEEP,
      ...SECTION_LEVELS.REVIEW
    ];
    const currentIndex = allSections.indexOf(section);
    if (currentIndex < allSections.length - 1) {
      const nextSection = allSections[currentIndex + 1];
      if (!visibleSections.includes(nextSection)) {
        setVisibleSections(prev => [...prev, nextSection]);
      }
      setEditingSection(nextSection);
      const nextJourneyIndex = JOURNEY_STEPS.indexOf(nextSection);
      if (nextJourneyIndex >= 0) {
        setCurrentSectionIndex(prev => Math.max(prev, nextJourneyIndex));
      }
      setTimeout(() => {
        sectionRefs.current[nextSection]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    }
  };

  const handleSave = (section: Section) => {
    if (!draftProfile) return;

    const mandatoryMissing = getMandatoryMissingFields(section, draftProfile);
    if (Object.keys(mandatoryMissing).length > 0) {
      setValidationErrors({ section, fields: mandatoryMissing });
      return;
    }

    setProfile(draftProfile);
    setDraftProfile(null);

    if (!savedSections.includes(section)) {
      setSavedSections(prev => [...prev, section]);
    }
    setEditingSection(null);
    setValidationErrors(null);
    if (hasEnoughForMilestone(section, draftProfile)) {
      triggerMilestoneCelebration(section);
    }
    setJourneyMessage(`${section === Section.BASIC ? 'Identity' : section === Section.ACADEMIC ? 'Academics' : section === Section.SKILLS ? 'Expertise' : section === Section.MILESTONES ? 'Milestones' : 'Reflections'} completed ✅`);
    setXpMessage('+10 XP');
    setTimeout(() => setXpMessage(null), 1400);
    
    // Auto scroll to next section
    const allSections = [
      ...SECTION_LEVELS.BASELINE,
      ...SECTION_LEVELS.DEEP,
      ...SECTION_LEVELS.REVIEW
    ];
    const currentIndex = allSections.indexOf(section);
    if (currentIndex < allSections.length - 1) {
      const nextSection = allSections[currentIndex + 1];
      if (!visibleSections.includes(nextSection)) {
        setVisibleSections(prev => [...prev, nextSection]);
      }
      setEditingSection(nextSection);
      const nextJourneyIndex = JOURNEY_STEPS.indexOf(nextSection);
      if (nextJourneyIndex >= 0) {
        setCurrentSectionIndex(prev => Math.max(prev, nextJourneyIndex));
      }
      setTimeout(() => {
        sectionRefs.current[nextSection]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }, 100);
    } else {
      setEditingSection(null);
    }
  };

  const isSectionFilled = (section: Section, prof: Profile = profile): boolean => {
    if (section === Section.BASIC) {
      return !!(prof.email.trim() || prof.location.trim() || prof.gender || prof.pronouns);
    }
    if (section === Section.ACADEMIC) {
      return !!(
        prof.collegeName.trim() || 
        prof.degreeType || 
        prof.yearOfStudy || 
        prof.graduationYear ||
        prof.cgpa || 
        prof.topLevelCategory || 
        prof.specializationCategory || 
        prof.specialization
      );
    }
    if (section === Section.SKILLS) {
      return (
        prof.subjectSkills.length > 0 || 
        prof.toolSkills.length > 0 || 
        prof.aiSkills.length > 0 || 
        prof.professionalSkills.length > 0 ||
        prof.interests.length > 0
      );
    }
    if (section === Section.MILESTONES) {
      return (
        prof.projects.length > 0 ||
        prof.exams.length > 0 ||
        prof.certifications.length > 0
      );
    }
    if (section === Section.REFLECTIONS) {
      return (Object.values(prof.reflections) as string[]).some(v => !!v && v.trim().length > 0);
    }
    return false;
  };

  const getJourneyIndex = (section: Section | null): number => {
    if (!section) return 0;
    const idx = JOURNEY_STEPS.indexOf(section);
    return idx >= 0 ? idx : 0;
  };

  const handleStart = (importedProfile?: Profile) => {
    if (importedProfile) {
      const merged = mergeProfileWithDefaults(importedProfile);
      setProfile(merged);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      
      const isReturningUser = !!(merged.email || merged.collegeName || merged.degreeType);
      
      if (isReturningUser) {
        const filledSections = Object.values(Section).filter(s => s !== Section.REVIEW && isSectionFilled(s, merged));
        setSavedSections(filledSections);
      } else {
        setSavedSections([]);
      }
      
      const newVisibleSections: Section[] = [Section.BASIC];
      let firstEmptySection: Section | null = null;
      
      if (!isSectionFilled(Section.BASIC, merged)) {
        firstEmptySection = Section.BASIC;
      }
      
      const sectionsToCheck = [Section.ACADEMIC, Section.SKILLS, Section.MILESTONES, Section.REFLECTIONS];
      for (const sec of sectionsToCheck) {
        if (isSectionFilled(sec, merged)) {
          if (!newVisibleSections.includes(sec)) newVisibleSections.push(sec);
        } else if (!firstEmptySection) {
          if (!newVisibleSections.includes(sec)) newVisibleSections.push(sec);
          firstEmptySection = sec;
        }
      }
      if (!firstEmptySection) {
        newVisibleSections.push(Section.REVIEW);
      }
      
      setVisibleSections(newVisibleSections);
      setEditingSection(firstEmptySection);
      setCurrentSectionIndex(firstEmptySection ? getJourneyIndex(firstEmptySection) : JOURNEY_STEPS.length - 1);
      setLevel2AccessGranted(isSectionFilled(Section.REFLECTIONS, merged));
    } else {
      // If it's a new profile, make the first section editable
      setEditingSection(Section.BASIC);
      setCurrentSectionIndex(0);
      setLevel2AccessGranted(false);
    }
    setIsStarted(true);
    window.scrollTo(0, 0);
  };

  const triggerMilestoneCelebration = (section: Section) => {
    const possibleEmojis = MILESTONE_EMOJIS[section] || ['✨'];
    const singleEmoji = possibleEmojis[Math.floor(Math.random() * possibleEmojis.length)];
    setCurrentBurstEmojis([singleEmoji]);
    setShowMilestoneBurst(true);
    
    const messages: Record<string, string> = {
      [Section.BASIC]: "Identity Anchored! ⚓",
      [Section.ACADEMIC]: "Academic Foundations Set! 🎓",
      [Section.SKILLS]: "Expertise Core Built! 🚀",
      [Section.MILESTONES]: "Milestones & Projects Captured! 🏆",
      [Section.REFLECTIONS]: "Deep Reflections Captured! 🧠",
      [Section.REVIEW]: "Profile Ready for Curie! 🏁"
    };
    
    setSuccessToast({ message: messages[section] || "Section Completed!", section });
    
    if (section === Section.REVIEW || completeness === 100) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#2c4869', '#ffcd29', '#f58434']
      });
    }

    setTimeout(() => setShowMilestoneBurst(false), 100);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const getMandatoryMissingFields = (section: Section, prof: Profile = profile): Record<string, string> => {
    const missing: Record<string, string> = {};
    if (section === Section.BASIC) {
      if (!prof.fullName.trim()) missing["fullName"] = "This field is required";
      if (!prof.whatsappNumber?.trim()) missing["whatsappNumber"] = "This field is required";
    } else if (section === Section.ACADEMIC) {
      if (!prof.academicStatus) missing["academicStatus"] = "This field is required";
      if (!prof.collegeName.trim()) missing["collegeName"] = "This field is required";
      if (!prof.degreeType) missing["degreeType"] = "This field is required";
      if (!prof.topLevelCategory) missing["topLevelCategory"] = "This field is required";
    } else if (section === Section.SKILLS) {
      const hasExpertise = 
        prof.subjectSkills.length > 0 || 
        prof.toolSkills.length > 0 || 
        prof.aiSkills.length > 0 || 
        prof.professionalSkills.length > 0 ||
        prof.interests.length > 0;
      
      if (!hasExpertise) {
        missing["expertise"] = "This field is required";
      }
    } else if (section === Section.MILESTONES) {
      const hasMilestones = 
        prof.projects.length > 0 || 
        prof.exams.length > 0 ||
        prof.certifications.length > 0;

      if (!hasMilestones) {
        missing["milestones"] = "This field is required";
      }

      prof.projects.forEach((project, index) => {
        if (!project.name.trim()) missing[`projectName_${index}`] = "This field is required";
        if (project.name.trim() && !project.status) missing[`projectStatus_${index}`] = "This field is required";
      });
      prof.exams.forEach((exam, index) => {
        if (!exam.name.trim()) missing[`examName_${index}`] = "This field is required";
        if (exam.name.trim() && !exam.status) missing[`examStatus_${index}`] = "This field is required";
      });
      prof.certifications.forEach((cert, index) => {
        if (!cert.name.trim()) missing[`certificationName_${index}`] = "This field is required";
        if (cert.name.trim() && !cert.status) missing[`certificationStatus_${index}`] = "This field is required";
      });
    } else if (section === Section.REFLECTIONS) {
      const hasAnyReflection = (Object.values(prof.reflections) as string[]).some((v) => !!v && v.trim().length > 0);
      if (!hasAnyReflection) {
        missing["reflections"] = "Please fill all required fields marked with *";
      }
    }
    return missing;
  };

  const validateSection = (section: Section): Record<string, string> => {
    const missing: Record<string, string> = {};
    if (section === Section.BASIC) {
      if (!profile.fullName.trim()) missing["fullName"] = "Full Name is required";
      if (!profile.whatsappNumber?.trim()) missing["whatsappNumber"] = "WhatsApp Number is required";
      if (!profile.email.trim()) missing["email"] = "Email address is required";
      if (!profile.location.trim()) missing["location"] = "Current location is required";
    } else if (section === Section.ACADEMIC) {
      if (!profile.collegeName.trim()) missing["collegeName"] = "Institution is required";
      if (!profile.degreeType) missing["degreeType"] = "Degree is required";
      if (!profile.yearOfStudy) missing["yearOfStudy"] = "Year of Study is required";
      if (profile.yearOfStudy === 'Alumnus' && !profile.graduationYear?.trim()) missing["graduationYear"] = "Graduation Year is required";
      if (!profile.cgpa.trim()) missing["cgpa"] = "CGPA is required";
      if (!profile.topLevelCategory) missing["topLevelCategory"] = "Broad STEM Stream is required";
      if (!profile.specializationCategory) missing["specializationCategory"] = "Specialization Category is required";
      if (!profile.specialization) missing["specialization"] = "Specialization is required";
    } else if (section === Section.SKILLS) {
      if (profile.subjectSkills.length === 0) missing["subjectSkills"] = "Subject Expertise is required";
      if (profile.toolSkills.length === 0) missing["toolSkills"] = "Technical Tools are required";
      if (profile.aiSkills.length === 0) missing["aiSkills"] = "AI & Data Skills are required";
      if (profile.professionalSkills.length === 0) missing["professionalSkills"] = "Professional Skills are required";
      if (profile.interests.length === 0) missing["interests"] = "Academic Interests are required";
    } else if (section === Section.MILESTONES) {
      const hasMilestones = 
        profile.projects.length > 0 || 
        profile.exams.length > 0 ||
        profile.certifications.length > 0;

      if (!hasMilestones) {
        missing["Projects"] = "Projects are required";
        missing["Exams"] = "Exams are required";
        missing["Certifications"] = "Certifications are required";
      }

      profile.projects.forEach((project, index) => {
        if (!project.name.trim()) missing[`projectName_${index}`] = `Project Title is required`;
        if (project.name.trim() && !project.status) missing[`projectStatus_${index}`] = `Status for ${project.name} is required`;
      });
      profile.exams.forEach((exam, index) => {
        if (!exam.name.trim()) missing[`examName_${index}`] = `Exam Name is required`;
        if (exam.name.trim() && !exam.status) missing[`examStatus_${index}`] = `Status for ${exam.name} is required`;
      });
      profile.certifications.forEach((cert, index) => {
        if (!cert.name.trim()) missing[`certificationName_${index}`] = `Certification Name is required`;
        if (cert.name.trim() && !cert.status) missing[`certificationStatus_${index}`] = `Status for ${cert.name} is required`;
      });
    } else if (section === Section.REFLECTIONS) {
      if (!profile.reflections.impactPurpose.trim()) missing["impactPurpose"] = "Impact & Purpose is required";
      if (!profile.reflections.strengths.trim()) missing["strengths"] = "Strengths is required";
      if (!profile.reflections.curiosity.trim()) missing["curiosity"] = "Curiosity is required";
      if (!profile.reflections.grittyGrowth.trim()) missing["grittyGrowth"] = "Gritty Growth is required";
      if (!profile.reflections.spark.trim()) missing["spark"] = "Spark is required";
      if (!profile.reflections.opportunities.trim()) missing["opportunities"] = "Opportunities is required";
      if (!profile.reflections.threats.trim()) missing["threats"] = "Threats is required";
    }
    return missing;
  };



  const calculateCompleteness = () => {
    const fields = [
      // Identity & Academic (10)
      profile.fullName,
      profile.gender,
      profile.pronouns,
      profile.whatsappNumber,
      profile.email,
      profile.location,
      profile.collegeName,
      profile.degreeType,
      profile.yearOfStudy,
      ...(profile.yearOfStudy === 'Alumnus' ? [profile.graduationYear] : []),
      profile.cgpa,
      profile.topLevelCategory,
      profile.specializationCategory,
      profile.specialization,
      
      // Expertise Core (5)
      profile.subjectSkills.length > 0 ? 'filled' : '',
      profile.toolSkills.length > 0 ? 'filled' : '',
      profile.aiSkills.length > 0 ? 'filled' : '',
      profile.professionalSkills.length > 0 ? 'filled' : '',
      profile.interests.length > 0 ? 'filled' : '',

      // Milestones & Projects (3)
      profile.projects.length > 0 ? 'filled' : '',
      profile.exams.length > 0 ? 'filled' : '',
      profile.certifications.length > 0 ? 'filled' : '',

      // Reflections (7)
      ...Object.values(profile.reflections)
    ];

    const filledCount = fields.filter(f => {
      if (typeof f === 'string') return f.trim().length > 0;
      return !!f;
    }).length;

    return Math.round((filledCount / fields.length) * 100);
  };

  const getRequiredProgress = () => {
    const graduationRequired = profile.yearOfStudy === 'Alumnus' ? 1 : 0;
    const total =
      4 + // identity: fullName, whatsapp, email, location
      (7 + graduationRequired) + // academics
      5 + // expertise
      3 + // milestones categories
      7; // reflections

    let filled = 0;

    // Identity
    if (profile.fullName.trim()) filled += 1;
    if (profile.whatsappNumber?.trim()) filled += 1;
    if (profile.email.trim()) filled += 1;
    if (profile.location.trim()) filled += 1;

    // Academics
    if (profile.collegeName.trim()) filled += 1;
    if (profile.degreeType) filled += 1;
    if (profile.yearOfStudy) filled += 1;
    if (profile.yearOfStudy === 'Alumnus' && profile.graduationYear?.trim()) filled += 1;
    if (profile.cgpa.trim()) filled += 1;
    if (profile.topLevelCategory) filled += 1;
    if (profile.specializationCategory) filled += 1;
    if (profile.specialization) filled += 1;

    // Expertise
    if (profile.subjectSkills.length > 0) filled += 1;
    if (profile.toolSkills.length > 0) filled += 1;
    if (profile.aiSkills.length > 0) filled += 1;
    if (profile.professionalSkills.length > 0) filled += 1;
    if (profile.interests.length > 0) filled += 1;

    // Milestones
    if (profile.projects.length > 0) filled += 1;
    if (profile.exams.length > 0) filled += 1;
    if (profile.certifications.length > 0) filled += 1;

    // Reflections
    if (profile.reflections.impactPurpose.trim()) filled += 1;
    if (profile.reflections.strengths.trim()) filled += 1;
    if (profile.reflections.curiosity.trim()) filled += 1;
    if (profile.reflections.grittyGrowth.trim()) filled += 1;
    if (profile.reflections.spark.trim()) filled += 1;
    if (profile.reflections.opportunities.trim()) filled += 1;
    if (profile.reflections.threats.trim()) filled += 1;

    const percent = total > 0 ? Math.round((filled / total) * 100) : 0;
    return { total, filled, percent };
  };

  const isSectionDirty = (section: Section, prof: Profile = profile): boolean => {
    if (section === Section.BASIC) {
      return !!(prof.fullName.trim() || prof.gender || prof.pronouns || prof.email.trim() || prof.location.trim());
    }
    if (section === Section.ACADEMIC) {
      return !!(
        prof.collegeName.trim() || 
        prof.degreeType || 
        prof.yearOfStudy || 
        prof.graduationYear ||
        prof.cgpa || 
        prof.topLevelCategory || 
        prof.specializationCategory || 
        prof.specialization
      );
    }
    if (section === Section.SKILLS) {
      return (
        prof.subjectSkills.length > 0 || 
        prof.toolSkills.length > 0 || 
        prof.aiSkills.length > 0 || 
        prof.professionalSkills.length > 0 ||
        prof.interests.length > 0
      );
    }
    if (section === Section.MILESTONES) {
      return (
        prof.projects.length > 0 ||
        prof.exams.length > 0 ||
        prof.certifications.length > 0
      );
    }
    if (section === Section.REFLECTIONS) {
      return (Object.values(prof.reflections) as string[]).some(v => !!v && v.trim().length > 0);
    }
    return false;
  };

  const hasEnoughForMilestone = (section: Section, prof: Profile = profile): boolean => {
    if (section === Section.BASIC) {
      const filled = [prof.fullName, prof.gender, prof.pronouns, prof.whatsappNumber, prof.email, prof.location].filter(v => v && v.trim()).length;
      return filled >= 2;
    }
    if (section === Section.ACADEMIC) {
      const filled = [
        prof.collegeName, 
        prof.degreeType, 
        prof.yearOfStudy, 
        prof.graduationYear,
        prof.cgpa, 
        prof.topLevelCategory, 
        prof.specializationCategory, 
        prof.specialization
      ].filter(v => v && v.trim()).length;
      return filled >= 3;
    }
    if (section === Section.SKILLS) {
      const filled = [
        prof.subjectSkills.length > 0,
        prof.toolSkills.length > 0,
        prof.aiSkills.length > 0,
        prof.professionalSkills.length > 0,
        prof.interests.length > 0
      ].filter(Boolean).length;
      return filled >= 2;
    }
    if (section === Section.MILESTONES) {
      const filled = [
        prof.projects.length > 0,
        prof.exams.length > 0,
        prof.certifications.length > 0
      ].filter(Boolean).length;
      return filled >= 1;
    }
    if (section === Section.REFLECTIONS) {
      const filled = (Object.values(prof.reflections) as string[]).filter(v => !!v && v.trim().length > 0).length;
      return filled >= 2;
    }
    return false;
  };

  const completeness = calculateCompleteness();
  const countMandatoryChecks = (section: Section, prof: Profile = profile): number => {
    if (section === Section.BASIC) return 2;
    if (section === Section.ACADEMIC) return 4;
    if (section === Section.SKILLS) return 1;
    if (section === Section.MILESTONES) {
      let checks = 1;
      checks += prof.projects.length;
      checks += prof.exams.length;
      checks += prof.certifications.length;
      return checks;
    }
    return 0;
  };

  const getMandatoryProgressForSections = (sectionsToTrack: Section[]) => {
    const total = sectionsToTrack.reduce((sum, section) => sum + countMandatoryChecks(section), 0);
    const missing = sectionsToTrack.reduce((sum, section) => sum + Object.keys(getMandatoryMissingFields(section)).length, 0);
    const completed = Math.max(0, total - missing);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 100;
    return { total, completed, percent };
  };

  const level1Progress = getMandatoryProgressForSections(LEVEL_1_SECTIONS);
  const level2Progress = getMandatoryProgressForSections(LEVEL_2_SECTIONS);
  const level1Complete = level1Progress.percent === 100;
  const identityComplete = Object.keys(getMandatoryMissingFields(Section.BASIC)).length === 0;
  const academicsComplete = Object.keys(getMandatoryMissingFields(Section.ACADEMIC)).length === 0;
  const expertiseComplete = Object.keys(getMandatoryMissingFields(Section.SKILLS)).length === 0;
  const milestonesComplete = Object.keys(getMandatoryMissingFields(Section.MILESTONES)).length === 0;
  const avatarStage =
    level1Complete
      ? 5
      : academicsComplete && expertiseComplete && milestonesComplete
      ? 4
      : academicsComplete || expertiseComplete
      ? 3
      : identityComplete
      ? 2
      : 1;
  const avatarStageMap: Record<number, { emoji: string; title: string; subtitle: string }> = {
    1: { emoji: '👩‍🎓', title: 'Starting Your Journey', subtitle: 'College-going dreamer taking the first step.' },
    2: { emoji: '🙋‍♀️', title: 'Understanding Yourself', subtitle: 'Clarity grows as your identity takes shape.' },
    3: { emoji: '👩‍💻', title: 'Building Your Skills', subtitle: 'Focused effort is turning potential into capability.' },
    4: { emoji: '💡👩‍💼', title: 'Shaping Your Career Path', subtitle: 'Your profile now reflects emerging professionalism.' },
    5: { emoji: '👩‍💼', title: 'Career Ready', subtitle: 'Confident, polished, and ready for opportunities.' },
  };
  const currentAvatarMeta = avatarStageMap[avatarStage];
  const requiredProgress = getRequiredProgress();
  const level2TotalFields = Object.values(profile.reflections).length;
  const level2FilledFields = (Object.values(profile.reflections) as string[]).filter((v) => v && v.trim().length > 0).length;
  const level2UiProgress = level2TotalFields > 0 ? Math.round((level2FilledFields / level2TotalFields) * 100) : 0;
  const isLevel1Active = editingSection ? LEVEL_1_SECTIONS.includes(editingSection) : false;
  const isLevel2Active = editingSection ? LEVEL_2_SECTIONS.includes(editingSection) : false;
  const completedMap: Record<Section, boolean> = {
    [Section.BASIC]: Object.keys(validateSection(Section.BASIC)).length === 0,
    [Section.ACADEMIC]: Object.keys(validateSection(Section.ACADEMIC)).length === 0,
    [Section.SKILLS]: Object.keys(validateSection(Section.SKILLS)).length === 0,
    [Section.MILESTONES]: Object.keys(validateSection(Section.MILESTONES)).length === 0,
    [Section.REFLECTIONS]: Object.keys(validateSection(Section.REFLECTIONS)).length === 0,
    [Section.REVIEW]: false,
  };
  const unlockedCount = Math.min(JOURNEY_STEPS.length, currentSectionIndex + 1);
  const completedCount = JOURNEY_STEPS.filter((s) => completedMap[s]).length;
  const overallJourneyProgress = Math.round((completedCount / JOURNEY_STEPS.length) * 100);

  useEffect(() => {
    if (level1Complete && !level2PromptHandled) {
      setShowLevel2Prompt(true);
    }
  }, [level1Complete, level2PromptHandled]);

  useEffect(() => {
    if (unlockedCount > previousUnlockedCountRef.current && unlockedCount <= JOURNEY_STEPS.length) {
      const justUnlocked = JOURNEY_STEPS[unlockedCount - 1];
      const unlockedName =
        justUnlocked === Section.BASIC
          ? 'Identity'
          : justUnlocked === Section.ACADEMIC
          ? 'Academics'
          : justUnlocked === Section.SKILLS
          ? 'Expertise'
          : justUnlocked === Section.MILESTONES
          ? 'Milestones'
          : 'Reflections';
      setJourneyMessage(`You unlocked ${unlockedName} 🎉`);
      setTimeout(() => setJourneyMessage(null), 2200);
    }
    previousUnlockedCountRef.current = unlockedCount;
  }, [unlockedCount]);

  useEffect(() => {
    if (avatarStage > previousAvatarStageRef.current) {
      setAvatarGrowthToast(`🎉 You've grown into a ${currentAvatarMeta.title}!`);
      setTimeout(() => setAvatarGrowthToast(null), 2600);
    }
    previousAvatarStageRef.current = avatarStage;
  }, [avatarStage, currentAvatarMeta.title]);

  const handleProceedToLevel2 = () => {
    setVisibleSections((prev) => {
      const next = [...prev];
      LEVEL_2_SECTIONS.forEach((sec) => {
        if (!next.includes(sec)) next.push(sec);
      });
      return next;
    });
    setEditingSection(Section.REFLECTIONS);
    setCurrentSectionIndex(Math.max(currentSectionIndex, JOURNEY_STEPS.indexOf(Section.REFLECTIONS)));
    setLevel2AccessGranted(true);
    setShowLevel2Prompt(false);
    setLevel2PromptHandled(true);
    setReflectionsFocusPulse(true);
    setTimeout(() => setReflectionsFocusPulse(false), 1800);
    setTimeout(() => {
      sectionRefs.current[Section.REFLECTIONS]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSkipLevel2Prompt = () => {
    setShowLevel2Prompt(false);
    setLevel2PromptHandled(true);
    setLevel2AccessGranted(false);
    setVisibleSections((prev) => {
      const next = [...prev];
      if (!next.includes(Section.REVIEW)) next.push(Section.REVIEW);
      return next;
    });
    setEditingSection(Section.REVIEW);
    setCurrentSectionIndex(JOURNEY_STEPS.length - 1);
    setTimeout(() => {
      sectionRefs.current[Section.REVIEW]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const completeSection = (section: Section, forceSkip: boolean = false) => {
    if (!forceSkip) {
      const mandatoryMissing = getMandatoryMissingFields(section);
      if (Object.keys(mandatoryMissing).length > 0) {
        setValidationErrors({ section, fields: mandatoryMissing });
        return;
      }

      const missingFields = validateSection(section);
      if (Object.keys(missingFields).length > 0) {
        setValidationErrors({ section, fields: missingFields });
        return;
      }
    } else {
      setSkipMessage("No problem. We'll move ahead for now. However, we highly recommend that you add this later to receive more personalized guidance");
      setTimeout(() => setSkipMessage(null), 6000);
    }

    setValidationErrors(null);
    const sections = Object.values(Section);
    const currentIndex = sections.indexOf(section);
    
    if (currentIndex < sections.length - 1) {
      const nextSection = sections[currentIndex + 1];
      
      if (!visibleSections.includes(nextSection)) {
        if (!forceSkip && hasEnoughForMilestone(section)) {
          triggerMilestoneCelebration(section);
        }
        setVisibleSections(prev => [...prev, nextSection]);
        setEditingSection(nextSection);
        const nextJourneyIndex = JOURNEY_STEPS.indexOf(nextSection);
        if (nextJourneyIndex >= 0) {
          setCurrentSectionIndex(prev => Math.max(prev, nextJourneyIndex));
        }
        
        // Scroll to next section after a short delay to allow it to render
        setTimeout(() => {
          sectionRefs.current[nextSection]?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
          });
        }, 100);
      } else {
        // Already visible, move editing focus to next
        setEditingSection(nextSection);
        const nextJourneyIndex = JOURNEY_STEPS.indexOf(nextSection);
        if (nextJourneyIndex >= 0) {
          setCurrentSectionIndex(prev => Math.max(prev, nextJourneyIndex));
        }
        sectionRefs.current[nextSection]?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start' 
        });
      }
    } else {
      // Last section completed
      setEditingSection(null);
    }
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#2c4869]/20 border-t-[#2c4869] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth onLogin={(u) => { 
      setUser(u); 
      setIsAuthenticated(true); 
      
      // Auto-start after login
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          handleStart(parsed);
        } catch (e) {
          handleStart();
        }
      } else {
        handleStart();
      }
    }} />;
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] flex flex-col pb-32">
      <EmojiBurst trigger={showMilestoneBurst} emojis={currentBurstEmojis} />
      
      <AnimatePresence>
        {successToast && (
          <motion.div 
            key="success-toast"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
          >
            <div className="bg-[#2c4869] text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20 backdrop-blur-md">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 text-xl">
                👏
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 leading-none mb-1">Milestone Reached</span>
                <span className="text-sm font-black tracking-tight">{successToast.message}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {avatarGrowthToast && (
          <motion.div
            key={avatarGrowthToast}
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="fixed top-24 right-6 z-[70]"
          >
            <div className="rounded-xl bg-[#2c4869] text-white text-xs font-bold px-4 py-2 shadow-lg">
              {avatarGrowthToast}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <div className="bg-white/40 backdrop-blur-md py-2.5 border-b border-slate-200/50 z-30 sticky top-0">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <img 
            src={VIGYAN_SHAALA_LOGO} 
            alt="VigyanShaala Logo" 
            className="h-9 sm:h-10 object-contain shrink-0"
          />
          <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-black tracking-[0.08em] text-[#2c4869] leading-none">
            STEM Growth Builder
          </h1>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              setIsAuthenticated(false);
              setUser(null);
              setIsStarted(false);
              setProfile(INITIAL_PROFILE);
              localStorage.removeItem(STORAGE_KEY);
            }}
            className="px-4 py-2 rounded-xl bg-[#2c4869] text-white text-[10px] font-black uppercase tracking-wider shadow-sm hover:bg-[#2c4869]/90 transition-all whitespace-nowrap"
          >
            Sign Out
          </button>
        </div>
      </div>

      <header className="sticky top-[38px] z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 flex flex-col shadow-sm">
        <div className="px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex flex-col gap-1">
            {profile.lastUpdatedAt && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                <div className="flex items-center gap-2 text-[9px] font-black text-[#2c4869]/40 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                  Draft Saved: {new Date(profile.lastUpdatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                {profile.lastSyncedAt && (
                  <div className="flex items-center gap-2 text-[9px] font-black text-emerald-500 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                    Sent to Curie: {new Date(profile.lastSyncedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-start gap-3 flex-1 justify-end w-full" />
        </div>
        
        <div className="w-full border-t border-slate-200/50 bg-slate-50/50 px-6 py-2.5 overflow-x-auto no-scrollbar">
          <div className="max-w-5xl mx-auto w-full space-y-2.5">
            <div className="max-w-4xl mx-auto rounded-2xl border border-slate-200 bg-white/90 shadow-sm px-3 py-2">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-center">
                <div className="w-full min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#2c4869]/60">Overall Progress</p>
                    <p className="text-[12px] font-black text-emerald-700">{requiredProgress.percent}% Complete</p>
                  </div>
                  <div className="h-2.5 w-full bg-white border border-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-700 ease-in-out"
                      style={{ width: `${requiredProgress.percent}%` }}
                    />
                  </div>
                </div>
                <div className="md:ml-2 flex justify-center md:justify-end">
                  <motion.div
                    key={`top-avatar-${avatarStage}`}
                    initial={{ opacity: 0.6, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  >
                    <AvatarProgress
                      progress={overallJourneyProgress}
                      xpMessage={xpMessage}
                      small
                      avatarEmoji={currentAvatarMeta.emoji}
                      stageLabel={currentAvatarMeta.title}
                      stageSubtitle={currentAvatarMeta.subtitle}
                      activeState={avatarStage >= 5 ? 'completed' : avatarStage >= 3 ? 'active' : 'incomplete'}
                    />
                  </motion.div>
                </div>
              </div>
            </div>
            <div className="max-w-4xl mx-auto flex items-center gap-1.5 w-full justify-between">
            {JOURNEY_STEPS.map((sec, idx) => {
              const isCompleted = completedMap[sec];
              const isActive = editingSection === sec;
              const isUnlocked = idx <= currentSectionIndex;
              const isReflectionLocked = sec === Section.REFLECTIONS && !level1Complete;
              const isLocked = !isUnlocked || isReflectionLocked;
              const label =
                sec === Section.BASIC
                  ? 'IDENTITY'
                  : sec === Section.ACADEMIC
                  ? 'ACADEMICS'
                  : sec === Section.SKILLS
                  ? 'EXPERTISE'
                  : sec === Section.MILESTONES
                  ? 'MILESTONES'
                  : 'REFLECTIONS';

              return (
                <React.Fragment key={sec}>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      if (isReflectionLocked) {
                        setSkipMessage('Please complete all required Level 1 sections to unlock Reflections.');
                        setTimeout(() => setSkipMessage(null), 3200);
                        return;
                      }
                      setEditingSection(sec);
                      sectionRefs.current[sec]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-black tracking-wider transition-all border ${
                      isCompleted
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : isActive
                        ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-sm'
                        : isLocked
                        ? 'bg-white text-slate-300 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isCompleted ? `✅ ${label}` : isLocked ? `🔒 ${label}` : label}
                  </button>
                  {idx < JOURNEY_STEPS.length - 1 && (
                    <div className="w-5 h-[3px] rounded-full overflow-hidden bg-white border border-slate-200">
                      <div
                        className={`h-full transition-all duration-700 ease-in-out ${
                          completedMap[sec] ? 'w-full bg-emerald-500' : 'w-0 bg-emerald-500'
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {skipMessage && (
          <motion.div 
            key="skip-message"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-6"
          >
            <div className="bg-[#2c4869] text-white p-4 rounded-xl shadow-2xl border border-white/10 flex items-start gap-3">
              <div className="mt-0.5">
                <svg className="w-5 h-5 text-[#ffcd29]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium leading-relaxed">
                {skipMessage}
              </p>
              <button onClick={() => setSkipMessage(null)} className="text-white/60 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 pt-8">
        <div className="grid grid-cols-1 gap-6 items-stretch">
        <div className="space-y-12 max-w-4xl mx-auto w-full">
        <section className="space-y-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-md transition-all duration-300">
          <p className="text-xs font-bold text-[#2c4869]/60">You're building your STEM journey!</p>
          {journeyMessage && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold text-[#2c4869]"
            >
              {journeyMessage}
            </motion.p>
          )}
          <p className={`text-[13px] font-bold text-center transition-colors duration-300 ${selectedLevelCard ? 'text-[#2c4869]' : 'text-[#f58434] animate-pulse'}`}>
            {selectedLevelCard ? 'Great! Continue building your profile below' : 'Click on the cards below to begin your journey'}
          </p>
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => {
                setSelectedLevelCard('level1');
                setVisibleSections((prev) => (prev.includes(Section.BASIC) ? prev : [Section.BASIC, ...prev]));
                setEditingSection(Section.BASIC);
                sectionRefs.current[Section.BASIC]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={`text-left rounded-2xl border p-4 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer ${
                selectedLevelCard === 'level1'
                  ? 'bg-[#f58434] border-[#f58434] text-white shadow-md'
                  : 'bg-white border-slate-200 text-[#2c4869] hover:border-[#f58434]/30'
              }`}
            >
              <p className={`text-xs font-black uppercase tracking-widest ${selectedLevelCard === 'level1' ? 'text-white' : 'text-[#2c4869]'}`}>🟢 Foundation Mode</p>
              <p className={`text-sm font-medium leading-relaxed ${selectedLevelCard === 'level1' ? 'text-white/90' : 'text-[#2c4869]/70'}`}>
                Complete your foundational profile to unlock personalized guidance.
              </p>
            </button>
            <button
              onClick={() => {
                setSelectedLevelCard('level2');
                if (!level1Complete) {
                  setSkipMessage('Please complete all required Level 1 sections to unlock Reflections.');
                  setTimeout(() => setSkipMessage(null), 3000);
                  return;
                }
                handleProceedToLevel2();
              }}
              className={`text-left rounded-2xl border p-4 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer ${
                selectedLevelCard === 'level2'
                  ? 'bg-[#f58434] border-[#f58434] text-white shadow-md'
                  : (level1Complete ? 'bg-white border-slate-200 text-[#2c4869] hover:border-[#f58434]/30' : 'border-slate-200 bg-slate-100/70')
              }`}
            >
              <p className={`text-xs font-black uppercase tracking-widest ${selectedLevelCard === 'level2' ? 'text-white' : 'text-[#2c4869]'}`}>🔵 Power-Up Mode</p>
              <p className={`text-sm font-medium leading-relaxed ${selectedLevelCard === 'level2' ? 'text-white/90' : 'text-[#2c4869]/70'}`}>
                Unlocked after baseline, providing tailored mentorship and insights.
              </p>
            </button>
          </div>
        </section>

        {selectedLevelCard && (
        <AnimatePresence mode="popLayout">
          {[
            { key: 'level1', title: '🟢 Foundation Mode', sections: LEVEL_1_SECTIONS, progress: level1Progress, locked: false },
            { key: 'level2', title: '🔵 Power-Up Mode', sections: LEVEL_2_SECTIONS, progress: level2Progress, locked: !level1Complete },
          ].map((levelGroup) => (
            <div key={levelGroup.key} className="space-y-8">
              {levelGroup.locked ? null : levelGroup.sections.map((section, index) => {
                if (!visibleSections.includes(section)) return null;
                if (section !== Section.REVIEW) {
                  const stepIndex = JOURNEY_STEPS.indexOf(section);
                  if (stepIndex >= 0 && stepIndex >= unlockedCount) return null;
                }
                if (section === Section.REFLECTIONS && !level2AccessGranted) return null;
                const sectionProfile = draftProfile || profile;
                const hasMandatoryMissing = Object.keys(getMandatoryMissingFields(section, sectionProfile)).length > 0;
                const lockIdentityActions = section === Section.BASIC && hasMandatoryMissing;
                return (
                  <motion.div 
                    key={section}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    ref={el => sectionRefs.current[section] = el}
                    className={`scroll-mt-48 transition-all duration-700 ${
                      section === Section.REFLECTIONS && reflectionsFocusPulse
                        ? 'ring-2 ring-emerald-300 rounded-2xl shadow-[0_0_22px_rgba(16,185,129,0.22)]'
                        : ''
                    }`}
                  >
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#2c4869] text-white text-[10px] font-black">
                    {index + 1}
                  </span>
                  <h2 className="text-2xl font-black text-[#2c4869]">
                    {section === Section.BASIC && "Let's start with the basics"}
                    {section === Section.ACADEMIC && "Your Academic Path"}
                    {section === Section.SKILLS && "Skills & Expertise"}
                    {section === Section.MILESTONES && "Achievements & Milestones"}
                    {section === Section.REFLECTIONS && "Your STEM Mindset"}
                    {section === Section.REVIEW && "Review Your Profile"}
                  </h2>
                  {section !== Section.REVIEW && Object.keys(validateSection(section)).length === 0 && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-[9px] font-black uppercase tracking-wider">Completed</span>
                    </motion.div>
                  )}
                  {section !== Section.REVIEW && savedSections.includes(section) && Object.keys(validateSection(section)).length > 0 && (
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-[9px] font-black uppercase tracking-wider">Incomplete</span>
                    </motion.div>
                  )}
                </div>
                {!(savedSections.includes(section) && editingSection !== section && isSectionFilled(section)) && (
                  <div className="text-[#2c4869]/60 font-medium">
                    {section === Section.BASIC && "Tell us who you are and how you’d like to be recognized in the STEM community."}
                    {section === Section.ACADEMIC && "Where are you currently learning? Tell us about your academic path and the subjects you’re diving into."}
                    {section === Section.SKILLS && (
                      <div className="space-y-1">
                        <p>What are you learning to do? From the tools you're just picking up to the skills you're mastering, every piece of your expertise helps Curie guide you.</p>
                        <p className="text-xs opacity-80 italic">You are required to fill at least one of the above fields to proceed.</p>
                        <p className="text-xs opacity-80 italic">Why this matters: This foundational info helps Curie address you correctly and understand your context.</p>
                      </div>
                    )}
                    {section === Section.MILESTONES && (
                      <div className="space-y-1">
                        <p>Add important steps in your learning journey — projects you have built, certifications you are pursuing, or exams that are part of your progress.</p>
                      </div>
                    )}
                    {section === Section.REFLECTIONS && "Your reflections help us understand who you are as a learner: what drives you, what you're good at, what you're curious about, and where you may need support in your STEM journey. There are no right or wrong answers."}
                    {section === Section.REFLECTIONS && (
                      <p className="text-xs opacity-80 italic mt-1">
                        You may fill any one of the below fields to proceed. Completing all is optional but recommended for better insights.
                      </p>
                    )}
                    {section === Section.REVIEW && "Check your answers before sending your data to Curie for personalized guidance."}
                  </div>
                )}
              </div>

              <div className="transition-all duration-300">
                {savedSections.includes(section) && editingSection !== section && isSectionFilled(section) && section !== Section.REVIEW ? (
                  <SectionSummary 
                    section={section} 
                    profile={profile} 
                    onEdit={() => setEditingSection(section)} 
                  />
                ) : (
                  <>
                    {section === Section.BASIC && (
                      <IdentityForm
                        profile={draftProfile || profile}
                        updateProfile={updateDraftProfile}
                        validationErrors={{
                          ...(validationErrors?.section === Section.BASIC ? validationErrors.fields : {}),
                          ...getMandatoryMissingFields(Section.BASIC, draftProfile || profile),
                        }}
                      />
                    )}
                    {section === Section.ACADEMIC && (
                      <AcademicForm profile={draftProfile || profile} updateProfile={updateDraftProfile} validationErrors={validationErrors?.section === Section.ACADEMIC ? validationErrors.fields : {}} />
                    )}
                    {section === Section.SKILLS && (
                      <ExpertiseForm profile={draftProfile || profile} updateProfile={updateDraftProfile} validationErrors={validationErrors?.section === Section.SKILLS ? validationErrors.fields : {}} />
                    )}
                    {section === Section.MILESTONES && (
                      <MilestoneForm profile={draftProfile || profile} updateProfile={updateDraftProfile} validationErrors={validationErrors?.section === Section.MILESTONES ? validationErrors.fields : {}} />
                    )}
                    {section === Section.REFLECTIONS && (
                      <ReflectionForm profile={draftProfile || profile} updateProfile={updateDraftProfile} validationErrors={validationErrors?.section === Section.REFLECTIONS ? validationErrors.fields : {}} />
                    )}
                    
                    {section !== Section.REVIEW && (
                      <div className="flex items-center justify-center gap-4 mt-8">
                        <button 
                          onClick={handleCancel}
                          disabled={lockIdentityActions}
                          className={`px-6 py-2.5 rounded-xl font-black transition-all ${
                            lockIdentityActions ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={() => handleSave(section)}
                          disabled={hasMandatoryMissing}
                          className={`px-6 py-2.5 rounded-xl font-black transition-all ${
                            hasMandatoryMissing
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                              : 'bg-[#2c4869] text-white shadow-lg hover:shadow-xl'
                          }`}
                        >
                          Save Changes
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
              {section === Section.REVIEW && (
                <ReviewPage 
                  profile={profile} 
                  completeness={completeness}
                  chatPreferences={chatPreferences}
                  setChatPreferences={setChatPreferences}
                  updateProfile={updateProfile}
                  setCurrentSection={(s) => {
                    setEditingSection(s);
                    setValidationErrors(null);
                    sectionRefs.current[s]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }} 
                />
              )}

              {section !== Section.REVIEW && (
                <div className="mt-12 space-y-6">
                  {editingSection !== section && (!savedSections.includes(section) || !isSectionFilled(section)) ? (
                    <>
                      {validationErrors?.section === section && Object.keys(validationErrors.fields).length > 0 && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 text-red-500">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-red-800 mb-1 uppercase tracking-wider">Please fill all required fields marked with *</p>
                              <ul className="text-sm text-red-700 leading-relaxed list-disc list-inside">
                                {Object.values(validationErrors.fields).map((error, i) => (
                                  <li key={i}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                      
                    </>
                  ) : null}
                </div>
              )}
              
              {/* Section Divider Removed */}
            </motion.div>
                );
              })}
            </div>
          ))}
        </AnimatePresence>
        )}
      </div>
      </div>
      </main>

      <AnimatePresence>
        {showLevel2Prompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#2c4869]/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl p-7 max-w-md w-full shadow-2xl border border-slate-100"
            >
              <h3 className="text-xl font-black text-[#2c4869] tracking-tight">🎉 Congratulations!</h3>
              <p className="text-sm text-[#2c4869]/70 font-medium mt-2 mb-6">
                You have successfully completed all required sections in Level 1.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={handleProceedToLevel2}
                  className="w-full py-3 rounded-xl bg-[#2c4869] text-white font-black uppercase tracking-widest text-xs hover:bg-[#2c4869]/90 transition-all"
                >
                  Proceed to Level 2
                </button>
                <button
                  onClick={handleSkipLevel2Prompt}
                  className="w-full py-3 rounded-xl bg-white border border-slate-200 text-[#2c4869]/70 font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all"
                >
                  Skip for Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
