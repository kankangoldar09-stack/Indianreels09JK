import React, { useState, useEffect, useRef, Component } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  onSnapshot,
  addDoc,
  updateDoc,
  increment,
  deleteDoc,
  where,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { createClient } from '@supabase/supabase-js';
import { UserProfile, Reel, ReelComment, ReelType, Story } from './types';
import { 
  Home, 
  Search, 
  PlusSquare, 
  Heart, 
  User as UserIcon, 
  LogOut, 
  MessageCircle, 
  Share2, 
  Bookmark,
  Settings,
  Moon,
  Sun,
  Camera,
  ExternalLink,
  Edit2,
  Check,
  Play,
  Upload,
  Volume2,
  VolumeX,
  MoreHorizontal,
  X
} from 'lucide-react';

// Initialize Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Guard against empty URL to prevent crash
let supabase: any;
try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } else {
    console.warn("Supabase credentials missing. Some features may not work.");
    // Mock supabase to prevent crashes on method calls
    supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }), order: () => Promise.resolve({ data: [] }) }), order: () => Promise.resolve({ data: [] }), single: () => Promise.resolve({ data: null }) }),
        insert: () => Promise.resolve({ error: null }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        delete: () => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
        upsert: () => Promise.resolve({ error: null }),
      }),
      storage: {
        from: () => ({
          upload: () => Promise.resolve({ error: null }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
      channel: () => ({ on: () => ({ subscribe: () => ({}) }), subscribe: () => ({}) }),
      removeChannel: () => {},
      rpc: () => Promise.resolve({ error: null }),
    };
  }
} catch (e) {
  console.error("Failed to initialize Supabase:", e);
}

import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends (React.Component as any) {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    const { hasError, error } = this.state;
    if (hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black p-6 text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
            <X className="text-red-500" size={40} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-8 max-w-md">
            The application encountered an unexpected error. This might be due to missing configuration or a temporary issue.
          </p>
          <div className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded-xl mb-8 w-full max-w-lg overflow-auto text-left">
            <code className="text-xs text-red-500 font-mono">
              {error?.toString()}
            </code>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-orange-500 text-white rounded-2xl font-bold shadow-lg hover:bg-orange-600 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const StoryBar = ({ user }: { user: User | null }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [followingUids, setFollowingUids] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchFollowing = async () => {
      const { data } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.uid);
      
      if (data) {
        setFollowingUids([...data.map(f => f.following_id), user.uid]);
      } else {
        setFollowingUids([user.uid]);
      }
    };

    fetchFollowing();
  }, [user]);

  useEffect(() => {
    if (!user || followingUids.length === 0) {
      if (!user) setLoading(false);
      return;
    }

    const storiesRef = collection(db, 'stories');
    const now = new Date().toISOString();
    
    // Filter by following UIDs if possible (Firestore 'in' limit is 30)
    const limitedUids = followingUids.slice(0, 30);
    
    const q = query(
      storiesRef,
      where('creatorUid', 'in', limitedUids),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allStories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
      setStories(allStories);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching stories for bar:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, followingUids]);

  // Group stories by user
  const userStories = stories.reduce((acc, story) => {
    if (!acc[story.creatorUid]) {
      acc[story.creatorUid] = {
        uid: story.creatorUid,
        name: story.creatorName,
        photo: story.creatorPhoto,
        stories: []
      };
    }
    acc[story.creatorUid].stories.push(story);
    return acc;
  }, {} as Record<string, { uid: string, name: string, photo?: string, stories: Story[] }>);

  const storyUsers = Object.values(userStories);

  if (loading) return null;

  return (
    <div className="flex gap-4 p-4 overflow-x-auto scrollbar-hide border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-black">
      {/* Add Story Button */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <div className="relative">
          <div className="w-16 h-16 rounded-full p-0.5 border-2 border-zinc-200 dark:border-zinc-700">
            <img 
              src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName || 'User'}`} 
              className="w-full h-full rounded-full object-cover"
              alt="You"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full p-0.5 border-2 border-white dark:border-black">
            <PlusSquare size={14} />
          </div>
        </div>
        <span className="text-[10px] text-zinc-500">Your Story</span>
      </div>

      {/* Other Stories */}
      {storyUsers.filter((su: any) => su.uid !== user?.uid).map((su: any) => (
        <button 
          key={su.uid}
          onClick={() => setSelectedStory(su.stories[0])}
          className="flex flex-col items-center gap-1 flex-shrink-0"
        >
          <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-orange-500 via-pink-500 to-yellow-500">
            <div className="w-full h-full rounded-full p-0.5 bg-white dark:bg-black">
              <img 
                src={su.photo || `https://ui-avatars.com/api/?name=${su.name}`} 
                className="w-full h-full rounded-full object-cover"
                alt={su.name}
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <span className="text-[10px] text-zinc-500 truncate w-16">{su.name}</span>
        </button>
      ))}

      {/* Story Viewer Modal */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          >
            <button 
              onClick={() => setSelectedStory(null)}
              className="absolute top-6 right-6 text-white z-10 p-2 hover:bg-white/10 rounded-full"
            >
              <X size={32} />
            </button>

            <div className="relative w-full max-w-lg h-full md:h-[90vh] md:rounded-2xl overflow-hidden bg-zinc-900">
              {/* Progress Bar */}
              <div className="absolute top-4 left-4 right-4 flex gap-1 z-20">
                <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 5, ease: 'linear' }}
                    onAnimationComplete={() => setSelectedStory(null)}
                    className="h-full bg-white"
                  />
                </div>
              </div>

              {/* Header */}
              <div className="absolute top-8 left-4 flex items-center gap-3 z-20">
                <img 
                  src={selectedStory.creatorPhoto || `https://ui-avatars.com/api/?name=${selectedStory.creatorName}`}
                  className="w-8 h-8 rounded-full border border-white/20"
                  alt={selectedStory.creatorName}
                  referrerPolicy="no-referrer"
                />
                <span className="text-white font-medium text-sm shadow-sm">{selectedStory.creatorName}</span>
              </div>

              {selectedStory.mediaType === 'video' ? (
                <video 
                  src={selectedStory.mediaUrl} 
                  autoPlay 
                  className="w-full h-full object-contain"
                />
              ) : (
                <img 
                  src={selectedStory.mediaUrl} 
                  className="w-full h-full object-contain"
                  alt="Story"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Navbar = ({ activeTab, setActiveTab, user }: { activeTab: string, setActiveTab: (t: string) => void, user: User | null }) => {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'reels', icon: Play, label: 'Reels' },
    { id: 'stories', icon: Camera, label: 'Stories' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'upload', icon: PlusSquare, label: 'Create' },
    { id: 'profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 px-4 py-2 flex justify-around items-center z-50 transition-all duration-300",
      "md:top-0 md:bottom-auto md:flex-col md:w-20 md:h-full md:border-r",
      activeTab === 'reels' 
        ? "bg-black/20 backdrop-blur-lg border-t border-white/10 text-white" 
        : "bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800"
    )}>
      <div className="hidden md:block mb-8 mt-4">
        <span className="text-xl font-bold bg-gradient-to-r from-orange-500 via-white to-green-600 bg-clip-text text-transparent">IR</span>
      </div>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={cn(
            "p-2 rounded-xl transition-all duration-200",
            activeTab === tab.id 
              ? "text-orange-500 scale-110" 
              : activeTab === 'reels' ? "text-white/60 hover:text-white" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          )}
        >
          <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
        </button>
      ))}
      {user && (
        <button 
          onClick={() => signOut(auth)}
          className={cn(
            "hidden md:block mt-auto mb-4 p-2 transition-colors",
            activeTab === 'reels' ? "text-white/60 hover:text-red-400" : "text-zinc-500 hover:text-red-500"
          )}
        >
          <LogOut size={24} />
        </button>
      )}
    </nav>
  );
};

interface ReelCardProps {
  reel: Reel;
  currentUser: User | null;
  isMuted: boolean;
  setIsMuted: (m: boolean) => void;
}

const PostCard: React.FC<ReelCardProps> = ({ reel, currentUser, isMuted, setIsMuted }) => {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(reel.likesCount);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.5,
    };

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      });
    };

    const observer = new IntersectionObserver(callback, options);
    if (videoRef.current) observer.observe(videoRef.current);

    return () => {
      if (videoRef.current) observer.unobserve(videoRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const checkLike = async () => {
      const { data } = await supabase
        .from('likes')
        .select('*')
        .eq('user_id', currentUser.uid)
        .eq('reel_id', reel.id)
        .single();
      setLiked(!!data);
    };
    checkLike();
  }, [reel.id, currentUser]);

  const handleLike = async () => {
    if (!currentUser) return;

    try {
      if (liked) {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', currentUser.uid)
          .eq('reel_id', reel.id);
        
        const { error } = await supabase.rpc('decrement_likes', { reel_id: reel.id });
        if (error) {
          // Fallback if RPC fails
          await supabase.from('reels').update({ likes_count: Math.max(0, likes - 1) }).eq('id', reel.id);
        }
        setLikes(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('likes')
          .insert([{ user_id: currentUser.uid, reel_id: reel.id }]);
        
        const { error } = await supabase.rpc('increment_likes', { reel_id: reel.id });
        if (error) {
          // Fallback if RPC fails
          await supabase.from('reels').update({ likes_count: likes + 1 }).eq('id', reel.id);
        }
        setLikes(prev => prev + 1);
      }
      setLiked(!liked);
    } catch (err) {
      console.error("Like error:", err);
    }
  };

  return (
    <div className="bg-white dark:bg-black border-b border-zinc-100 dark:border-zinc-800 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-pink-500 p-0.5">
            <div className="w-full h-full rounded-full bg-white dark:bg-black p-0.5">
              {reel.creatorPhoto ? (
                <img src={reel.creatorPhoto} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center bg-orange-100 text-orange-600 font-bold text-xs">
                  {reel.creatorName[0]}
                </div>
              )}
            </div>
          </div>
          <span className="font-bold text-sm">{reel.creatorName}</span>
        </div>
        <button className="text-zinc-500"><MoreHorizontal size={20} /></button>
      </div>

      {/* Media */}
      <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
        <video 
          ref={videoRef}
          src={reel.videoUrl} 
          className="w-full h-full object-cover"
          loop
          muted={isMuted}
          autoPlay
          playsInline
          onClick={() => setIsMuted(!isMuted)}
        />
        
        {/* Mute/Unmute Indicator */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <AnimatePresence>
            {isMuted && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="bg-black/40 p-3 rounded-full text-white backdrop-blur-sm"
              >
                <VolumeX size={20} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button 
          onClick={() => setIsMuted(!isMuted)}
          className="absolute bottom-4 right-4 bg-black/50 p-2 rounded-full text-white backdrop-blur-sm"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* Actions */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <button onClick={handleLike} className={cn("transition-transform active:scale-125", liked ? "text-red-500" : "text-zinc-900 dark:text-white")}>
              <Heart size={24} fill={liked ? "currentColor" : "none"} />
            </button>
            <button className="text-zinc-900 dark:text-white"><MessageCircle size={24} /></button>
            <button className="text-zinc-900 dark:text-white"><Share2 size={24} /></button>
          </div>
          <button className="text-zinc-900 dark:text-white"><Bookmark size={24} /></button>
        </div>
        
        <div className="font-bold text-sm mb-1">{likes.toLocaleString()} likes</div>
        <div className="text-sm">
          <span className="font-bold mr-2">{reel.creatorName}</span>
          <span className="text-zinc-800 dark:text-zinc-200">{reel.caption}</span>
        </div>
        <button className="text-zinc-500 text-xs mt-2">View all {reel.commentsCount} comments</button>
        <div className="text-[10px] text-zinc-400 uppercase mt-1">2 hours ago</div>
      </div>
    </div>
  );
};

const ReelCard: React.FC<ReelCardProps> = ({ reel, currentUser, isMuted, setIsMuted }) => {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(reel.likesCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '0px',
      threshold: 0.7,
    };

    const callback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          videoRef.current?.play().catch(() => {});
        } else {
          videoRef.current?.pause();
        }
      });
    };

    const observer = new IntersectionObserver(callback, options);
    if (videoRef.current) observer.observe(videoRef.current);

    return () => {
      if (videoRef.current) observer.unobserve(videoRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const checkLike = async () => {
      const { data } = await supabase
        .from('likes')
        .select('*')
        .eq('user_id', currentUser.uid)
        .eq('reel_id', reel.id)
        .single();
      setLiked(!!data);
    };
    checkLike();
  }, [reel.id, currentUser]);

  useEffect(() => {
    if (!showComments) return;
    const fetchComments = async () => {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('reel_id', reel.id)
        .order('created_at', { ascending: false });
      
      if (data) {
        setComments(data.map(c => ({
          id: c.id,
          userUid: c.user_id,
          userName: c.user_name,
          userPhoto: c.user_photo,
          reelId: c.reel_id,
          text: c.text,
          createdAt: c.created_at
        })));
      }
    };
    fetchComments();

    // Real-time comments
    const channel = supabase
      .channel(`comments-${reel.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments', filter: `reel_id=eq.${reel.id}` }, (payload) => {
        const newC = payload.new;
        setComments(prev => [{
          id: newC.id,
          userUid: newC.user_id,
          userName: newC.user_name,
          userPhoto: newC.user_photo,
          reelId: newC.reel_id,
          text: newC.text,
          createdAt: newC.created_at
        }, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reel.id, showComments]);

  const handleLike = async () => {
    if (!currentUser) return;
    try {
      if (liked) {
        await supabase.from('likes').delete().eq('user_id', currentUser.uid).eq('reel_id', reel.id);
        const { error } = await supabase.rpc('decrement_likes', { reel_id: reel.id });
        if (error) {
          await supabase.from('reels').update({ likes_count: Math.max(0, likes - 1) }).eq('id', reel.id);
        }
        setLikes(prev => Math.max(0, prev - 1));
      } else {
        await supabase.from('likes').insert([{ user_id: currentUser.uid, reel_id: reel.id }]);
        const { error } = await supabase.rpc('increment_likes', { reel_id: reel.id });
        if (error) {
          await supabase.from('reels').update({ likes_count: likes + 1 }).eq('id', reel.id);
        }
        setLikes(prev => prev + 1);
      }
      setLiked(!liked);
    } catch (err) {
      console.error("Like error:", err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('comments')
        .insert([{
          user_id: currentUser.uid,
          user_name: currentUser.displayName || 'User',
          user_photo: currentUser.photoURL || '',
          reel_id: reel.id,
          text: newComment
        }]);

      if (error) throw error;
      await supabase.rpc('increment_comments', { reel_id: reel.id });
      setNewComment('');
    } catch (error) {
      console.error("Comment error", error);
    }
  };

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
      <video 
        ref={videoRef}
        src={reel.videoUrl} 
        className="h-full w-full object-cover"
        loop
        muted={isMuted}
        autoPlay
        playsInline
        onClick={() => setIsMuted(!isMuted)}
      />
      
      {/* Mute/Unmute Indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <AnimatePresence>
          {isMuted && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-black/60 px-6 py-3 rounded-full text-white flex items-center gap-2 backdrop-blur-md border border-white/20"
            >
              <VolumeX size={24} />
              <span className="text-sm font-bold">Tap for Sound</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Overlay Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent text-white">
        {reel.type === 'ad' && reel.adLink && (
          <a 
            href={reel.adLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full py-3 mb-4 bg-white text-black rounded-lg font-bold text-sm flex items-center justify-center gap-2 hover:bg-zinc-200 transition-colors shadow-lg"
          >
            Learn More <ExternalLink size={16} />
          </a>
        )}
        
        {reel.type === 'ad' && (
          <div className="mb-2 flex items-center gap-1">
            <span className="bg-orange-500 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-tighter">Sponsored</span>
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden border-2 border-orange-500">
            {reel.creatorPhoto ? (
              <img src={reel.creatorPhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-orange-100 text-orange-600 font-bold">
                {reel.creatorName?.[0] || 'U'}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm">{reel.creatorName}</span>
            {reel.type === 'ad' && <span className="text-[10px] opacity-70">Ad</span>}
          </div>
          <button className="ml-2 px-3 py-0.5 border border-white/50 rounded-lg text-xs font-medium hover:bg-white/20">Follow</button>
        </div>
        <p className="text-sm line-clamp-2 mb-3">{reel.caption}</p>
      </div>

      {/* Side Actions */}
      <div className="absolute right-4 bottom-20 flex flex-col gap-6 items-center">
        <div className="flex flex-col items-center">
          <button onClick={handleLike} className={cn("p-2 transition-transform active:scale-150", liked ? "text-red-500" : "text-white")}>
            <Heart size={32} fill={liked ? "currentColor" : "none"} />
          </button>
          <span className="text-white text-xs font-medium">{likes}</span>
        </div>
        <div className="flex flex-col items-center">
          <button onClick={() => setShowComments(true)} className="p-2 text-white">
            <MessageCircle size={32} />
          </button>
          <span className="text-white text-xs font-medium">{reel.commentsCount}</span>
        </div>
        <button 
          onClick={() => {
            const text = encodeURIComponent(`Check out this reel on INDIANREELS: ${reel.caption}\n\n${reel.videoUrl}`);
            window.open(`https://t.me/share/url?url=${reel.videoUrl}&text=${text}`, '_blank');
          }}
          className="p-2 text-white hover:text-blue-400 transition-colors"
        >
          <Share2 size={32} />
        </button>
        <button className="p-2 text-white">
          <Bookmark size={32} />
        </button>
      </div>

      {/* Comments Modal */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute inset-x-0 bottom-0 h-[70%] bg-white dark:bg-zinc-900 rounded-t-3xl z-50 flex flex-col"
          >
            <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold">Comments</h3>
              <button onClick={() => setShowComments(false)} className="text-zinc-500">Close</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden shrink-0">
                    {comment.userPhoto && <img src={comment.userPhoto} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{comment.userName}</span>
                      <span className="text-[10px] text-zinc-400">2h</span>
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">{comment.text}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <div className="h-full flex items-center justify-center text-zinc-400 italic">
                  No comments yet. Be the first!
                </div>
              )}
            </div>

            <form onSubmit={handleAddComment} className="p-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-2">
              <input 
                type="text" 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
              />
              <button type="submit" className="text-orange-500 font-bold text-sm px-2">Post</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AuthScreen = () => {
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user profile exists in Supabase
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.uid)
        .single();

      if (!existingProfile) {
        await supabase
          .from('profiles')
          .insert([{
            id: user.uid,
            display_name: user.displayName || 'Indian Reels User',
            email: user.email,
            photo_url: user.photoURL,
            bio: 'Namaste! I am new here.',
            is_private: false,
            followers_count: 0,
            following_count: 0,
            created_at: new Date().toISOString()
          }]);
      }
    } catch (error) {
      console.error("Auth error", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl p-8 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center"
      >
        <div className="mb-8 flex flex-col items-center">
          <div className="w-20 h-20 mb-4 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 via-white to-green-600 rounded-2xl rotate-12 opacity-20 animate-pulse" />
            <div className="relative w-full h-full bg-white dark:bg-zinc-800 rounded-2xl shadow-lg flex items-center justify-center border border-zinc-100 dark:border-zinc-700">
              <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-orange-500 border-b-[12px] border-b-transparent ml-1" />
            </div>
          </div>
          <h1 className="text-4xl font-black mb-2 tracking-tighter">
            <span className="text-orange-500">INDIAN</span>
            <span className="text-zinc-900 dark:text-white">REELS</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium">The heart of Indian creativity.</p>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={handleGoogleSignIn}
            className="w-full py-4 px-6 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-2xl font-bold flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="" />
            Continue with Google
          </button>
          
          <p className="text-[10px] text-zinc-400 mt-6 uppercase tracking-widest font-bold">
            Secure Login via Firebase
          </p>
        </div>
      </motion.div>
      
      {/* Decorative elements */}
      <div className="fixed top-0 left-0 w-full h-1.5 bg-gradient-to-r from-orange-500 via-white to-green-600" />
      <div className="fixed bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-green-600 via-white to-orange-500" />
    </div>
  );
};

const ReelScroller = ({ selectedId }: { selectedId: string | null }) => {
  useEffect(() => {
    if (selectedId) {
      const el = document.getElementById(`reel-${selectedId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto' });
      }
    }
  }, [selectedId]);
  return null;
};

const ProfileScreen = ({ 
  userProfile, 
  isOwnProfile, 
  currentUser,
  darkMode,
  setDarkMode,
  allReels,
  onReelClick,
  refreshProfile
}: { 
  userProfile: UserProfile, 
  isOwnProfile: boolean, 
  currentUser: User,
  darkMode: boolean,
  setDarkMode: (d: boolean) => void,
  allReels: Reel[],
  onReelClick: (id: string) => void,
  refreshProfile: () => void
}) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Edit Profile States
  const [editName, setEditName] = useState(userProfile.displayName);
  const [editUsername, setEditUsername] = useState(userProfile.username || '');
  const [editBio, setEditBio] = useState(userProfile.bio || '');
  const [editPhoto, setEditPhoto] = useState(userProfile.photoURL || '');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.uid}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      setEditPhoto(publicUrl);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const profileReels = allReels.filter(r => r.creatorUid === userProfile.uid);

  useEffect(() => {
    if (isOwnProfile || !currentUser) return;
    const checkFollow = async () => {
      const { data } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', currentUser.uid)
        .eq('following_id', userProfile.uid)
        .single();
      setIsFollowing(!!data);
    };
    checkFollow();
  }, [userProfile.uid, currentUser, isOwnProfile]);

  const handleFollow = async () => {
    if (!currentUser || isOwnProfile) return;

    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUser.uid).eq('following_id', userProfile.uid);
      await supabase.rpc('decrement_followers', { user_id: userProfile.uid });
      await supabase.rpc('decrement_following', { user_id: currentUser.uid });
    } else {
      await supabase.from('follows').insert([{ follower_id: currentUser.uid, following_id: userProfile.uid }]);
      await supabase.rpc('increment_followers', { user_id: userProfile.uid });
      await supabase.rpc('increment_following', { user_id: currentUser.uid });
    }
    setIsFollowing(!isFollowing);
    refreshProfile();
  };

  const handleUpdateProfile = async () => {
    if (!isOwnProfile || !currentUser) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: editName,
          username: editUsername.toLowerCase().replace(/\s/g, ''),
          bio: editBio,
          photo_url: editPhoto
        })
        .eq('id', currentUser.uid);

      if (error) throw error;
      
      // Also update Firestore if it exists
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          displayName: editName,
          username: editUsername.toLowerCase().replace(/\s/g, ''),
          photoURL: editPhoto,
          bio: editBio,
          uid: currentUser.uid
        }, { merge: true });
      } catch (e) {
        console.log("Firestore update skipped or failed", e);
      }

      setShowEditModal(false);
      refreshProfile();
    } catch (error) {
      console.error("Update profile error", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black pb-20 md:pl-20">
      <header className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          {!isOwnProfile && (
            <button 
              onClick={() => refreshProfile()} // In App.tsx we'll handle this as 'go back'
              className="p-2 -ml-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <X size={24} />
            </button>
          )}
          <h2 className="font-bold text-lg flex items-center gap-2">
            <div>
              <p className="leading-tight">{userProfile.displayName}</p>
              <p className="text-[10px] text-zinc-500 font-medium">@{userProfile.username}</p>
            </div>
            {isOwnProfile && <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded self-start mt-1">You</span>}
          </h2>
        </div>
        <div className="flex gap-2">
          {isOwnProfile && (
            <>
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <Settings size={20} />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="p-6">
        <div className="mb-4 flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold text-xs uppercase tracking-widest">
          <span className="animate-pulse">🇮🇳</span> Proudly Indian
        </div>
        <div className="flex items-center gap-6 mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-orange-500 via-pink-500 to-green-500 p-1">
            <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 p-1">
              {userProfile.photoURL ? (
                <img src={userProfile.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-2xl font-bold">
                  {userProfile.displayName?.[0] || 'U'}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-around text-center">
              <div>
                <div className="font-bold text-lg">{profileReels.length}</div>
                <div className="text-xs text-zinc-500">Reels</div>
              </div>
              <div>
                <div className="font-bold text-lg">{userProfile.followersCount}</div>
                <div className="text-xs text-zinc-500">Followers</div>
              </div>
              <div>
                <div className="font-bold text-lg">{userProfile.followingCount}</div>
                <div className="text-xs text-zinc-500">Following</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-bold">{userProfile.displayName}</h3>
          <p className="text-xs text-zinc-500 mb-2">@{userProfile.username}</p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">{userProfile.bio}</p>
        </div>

        {isOwnProfile ? (
          <button 
            onClick={() => setShowEditModal(true)}
            className="w-full py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg font-semibold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2"
          >
            <Edit2 size={16} /> Edit Profile
          </button>
        ) : (
          <button 
            onClick={handleFollow}
            className={cn(
              "w-full py-2 rounded-lg font-semibold text-sm transition-colors",
              isFollowing 
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white" 
                : "bg-orange-500 text-white hover:bg-orange-600"
            )}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}

        <div className="mt-8">
          {profileReels.length > 0 ? (
            <div className="grid grid-cols-3 gap-1">
              {profileReels.map(reel => (
                <div 
                  key={reel.id} 
                  onClick={() => onReelClick(reel.id)}
                  className="aspect-[9/16] bg-zinc-200 dark:bg-zinc-800 relative group cursor-pointer overflow-hidden rounded-md"
                >
                  <video src={reel.videoUrl} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                    <div className="flex items-center gap-1">
                      <Heart size={16} fill="white" />
                      <span className="text-xs font-bold">{reel.likesCount}</span>
                    </div>
                    {reel.type === 'ad' && <span className="text-[8px] bg-orange-500 px-1 rounded mt-1">AD</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <Play size={48} className="mb-2 opacity-20" />
              <p className="text-sm font-medium">No reels shared yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-6">Edit Profile</h3>
              <div className="space-y-4">
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-orange-500/20">
                      <img 
                        src={editPhoto || `https://ui-avatars.com/api/?name=${editName}`} 
                        className="w-full h-full object-cover" 
                        alt="Avatar"
                      />
                      {uploadingPhoto && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-orange-500 text-white p-2 rounded-full cursor-pointer shadow-lg hover:scale-110 transition-transform">
                      <Camera size={16} />
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                    </label>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-2 uppercase font-bold tracking-widest">Change Profile Picture</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Display Name</label>
                  <input 
                    type="text" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Username</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">@</span>
                    <input 
                      type="text" 
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                      placeholder="username"
                      className="w-full p-3 pl-8 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Bio</label>
                  <textarea 
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-orange-500 h-24 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateProfile}
                  disabled={saving}
                  className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-bold disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Settings</h3>
                <button onClick={() => setShowSettingsModal(false)} className="text-zinc-500">Close</button>
              </div>
              
              <div className="space-y-2">
                <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-2xl mb-4">
                  <p className="text-xs text-orange-600 dark:text-orange-400 font-bold text-center">🇮🇳 INDIANREELS v1.0 - Made with Love in India</p>
                </div>
                
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  className="w-full p-4 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span className="font-medium">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                  </div>
                  <div className={cn("w-10 h-5 rounded-full relative transition-colors", darkMode ? "bg-orange-500" : "bg-zinc-300")}>
                    <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", darkMode ? "right-1" : "left-1")} />
                  </div>
                </button>

                <button 
                  onClick={() => signOut(auth)}
                  className="w-full p-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut size={20} />
                  <span className="font-bold">Logout</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const UploadScreen = ({ user, onComplete }: { user: User, onComplete: () => void }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [type, setType] = useState<ReelType>('post');
  const [adLink, setAdLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl && !videoFile) return;
    if (!caption) return;
    if (type === 'ad' && !adLink) return;
    
    setLoading(true);
    setUploadProgress(0);
    try {
      let finalVideoUrl = videoUrl;

      // If a file is selected, upload to Supabase with progress
      if (videoFile) {
        const fileExt = videoFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.uid}/${fileName}`;

        // Using XMLHttpRequest for real progress tracking
        const uploadWithProgress = (file: File, path: string) => {
          return new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
            const supabaseKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
            
            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                setUploadProgress(percent);
              }
            };

            xhr.onload = () => {
              if (xhr.status === 200) {
                const { data: { publicUrl } } = supabase.storage
                  .from('media')
                  .getPublicUrl(path);
                resolve(publicUrl);
              } else {
                reject(new Error('Upload failed'));
              }
            };

            xhr.onerror = () => reject(new Error('Network error'));

            xhr.open('POST', `${supabaseUrl}/storage/v1/object/media/${path}`, true);
            xhr.setRequestHeader('Authorization', `Bearer ${supabaseKey}`);
            xhr.setRequestHeader('apikey', supabaseKey);
            xhr.send(file);
          });
        };

        finalVideoUrl = await uploadWithProgress(videoFile, filePath);

        // Optional: Send to Telegram if configured
        // We use the backend proxy to avoid CORS issues and keep the bot token secure
        try {
          const formData = new FormData();
          // We don't send the chat_id from frontend if we want it to be secure, 
          // but here we'll pass it to the proxy which will use the server-side token
          const chatId = import.meta.env.VITE_TELEGRAM_CHAT_ID;
          if (chatId) {
            formData.append('chat_id', chatId);
            formData.append('video', videoFile);
            formData.append('caption', `New Reel by ${user.displayName}\nCaption: ${caption}\nLink: ${finalVideoUrl}`);
            
            const response = await fetch('/api/telegram/sendVideo', {
              method: 'POST',
              body: formData
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || 'Telegram proxy failed');
            }
          }
        } catch (err) {
          console.error("Telegram notification failed", err);
        }
      }

      // Save to Supabase Database instead of Firestore to save storage/quota
      const { data: reelData, error: dbError } = await supabase
        .from('reels')
        .insert([{
          creator_uid: user.uid,
          creator_name: user.displayName || 'User',
          creator_photo: user.photoURL || '',
          video_url: finalVideoUrl,
          caption,
          type,
          ad_link: type === 'ad' ? adLink : null,
          likes_count: 0,
          comments_count: 0,
          is_public: true,
          created_at: new Date().toISOString()
        }]);

      if (dbError) throw dbError;
      
      // Reset form
      setVideoFile(null);
      setVideoUrl('');
      setCaption('');
      setAdLink('');
      setUploadProgress(0);
      
      onComplete();
    } catch (error: any) {
      console.error("Upload error", error);
      if (error.message === 'Bucket not found') {
        alert("Error: Supabase Storage bucket 'media' not found. Please create a public bucket named 'media' in your Supabase dashboard.");
      } else {
        alert("Upload failed: " + (error.message || "Unknown error"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-black p-6 md:pl-20">
      <h2 className="text-2xl font-bold mb-6">Create New</h2>
      
      <div className="flex gap-2 mb-8 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl">
        {(['post', 'story', 'ad'] as ReelType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold capitalize transition-all",
              type === t 
                ? "bg-white dark:bg-zinc-800 shadow-sm text-orange-500" 
                : "text-zinc-500"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <form onSubmit={handleUpload} className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-zinc-500">Upload Video File</label>
            <div className="relative group">
              <input 
                type="file" 
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="hidden"
                id="video-upload"
              />
              <label 
                htmlFor="video-upload"
                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl cursor-pointer hover:border-orange-500 transition-colors bg-zinc-50 dark:bg-zinc-900"
              >
                {videoFile ? (
                  <div className="text-center p-4">
                    <Play className="mx-auto text-orange-500 mb-2" size={32} />
                    <p className="text-sm font-bold truncate max-w-[200px]">{videoFile.name}</p>
                    <p className="text-xs text-zinc-400 mt-1">Click to change</p>
                  </div>
                ) : (
                  <div className="text-center p-4">
                    <Upload className="mx-auto text-zinc-400 mb-2" size={32} />
                    <p className="text-sm font-bold">Select Video File</p>
                    <p className="text-xs text-zinc-400 mt-1">MP4, WebM or MOV</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
            <span className="flex-shrink mx-4 text-zinc-400 text-[10px] font-bold uppercase tracking-widest">OR</span>
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-500">Video URL (Telegram/Direct Link)</label>
            <input 
              type="url" 
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-500">Caption</label>
          <textarea 
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption... #IndianReels"
            className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all h-32 resize-none"
            required
          />
        </div>

        {type === 'ad' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <label className="text-sm font-medium text-zinc-500">Ad Destination Link</label>
            <input 
              type="url" 
              value={adLink}
              onChange={(e) => setAdLink(e.target.value)}
              placeholder="https://your-website.com"
              className="w-full p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              required={type === 'ad'}
            />
          </motion.div>
        )}

        <button 
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                />
                <span>Uploading {uploadProgress}%</span>
              </div>
              <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden mt-2">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-white"
                />
              </div>
            </div>
          ) : (
            <>
              <Camera size={20} />
              Share {type === 'ad' ? 'Ad' : type === 'story' ? 'Story' : 'Reel'}
            </>
          )}
        </button>
      </form>
    </div>
  );
};

const StoriesScreen = ({ user }: { user: User }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [followingUids, setFollowingUids] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    // 1. Fetch following UIDs
    const followingRef = collection(db, 'users', user.uid, 'following');
    const unsubscribeFollowing = onSnapshot(followingRef, (snapshot) => {
      const uids = snapshot.docs.map(doc => doc.id);
      setFollowingUids([...uids, user.uid]); // Include self
    });

    return () => unsubscribeFollowing();
  }, [user.uid]);

  useEffect(() => {
    if (followingUids.length === 0) {
      setLoading(false);
      return;
    }

    const storiesRef = collection(db, 'stories');
    const now = new Date().toISOString();
    
    // Firestore 'in' query is limited to 30 items. 
    // For a prototype, we'll take the first 30 followed users.
    const limitedFollowingUids = followingUids.slice(0, 30);

    const q = query(
      storiesRef,
      where('creatorUid', 'in', limitedFollowingUids),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'asc')
    );

    const unsubscribeStories = onSnapshot(q, (snapshot) => {
      const allStories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Story));
      setStories(allStories);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching stories:", error);
      setLoading(false);
    });

    return () => unsubscribeStories();
  }, [followingUids]);

  const handleStoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `stories/${user.uid}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

      await addDoc(collection(db, 'stories'), {
        creatorUid: user.uid,
        creatorName: user.displayName || 'Anonymous',
        creatorPhoto: user.photoURL,
        mediaUrl: publicUrl,
        mediaType: file.type.startsWith('video') ? 'video' : 'image',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString()
      });
    } catch (err) {
      console.error('Error uploading story:', err);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 md:pl-20 min-h-screen bg-white dark:bg-black"
    >
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-black tracking-tighter">STORIES</h2>
        <label className="p-3 bg-orange-500 text-white rounded-full shadow-lg shadow-orange-500/20 cursor-pointer hover:scale-105 transition-transform">
          {isUploading ? (
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera size={24} />
          )}
          <input type="file" className="hidden" accept="image/*,video/*" onChange={handleStoryUpload} disabled={isUploading} />
        </label>
      </div>

      {stories.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from(new Set(stories.map(s => s.creatorUid))).map(uid => {
            const userStories = stories.filter(s => s.creatorUid === uid);
            const latestStory = userStories[userStories.length - 1];
            return (
              <div 
                key={uid} 
                onClick={() => setSelectedStory(latestStory)}
                className="aspect-[9/16] rounded-3xl overflow-hidden relative cursor-pointer group border-2 border-orange-500 p-1"
              >
                <div className="w-full h-full rounded-2xl overflow-hidden relative">
                  {latestStory.mediaType === 'video' ? (
                    <video src={latestStory.mediaUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={latestStory.mediaUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2">
                    <img 
                      src={latestStory.creatorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${latestStory.creatorName}`} 
                      className="w-8 h-8 rounded-full border-2 border-white"
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-white text-xs font-bold truncate max-w-[80px]">
                      {latestStory.creatorUid === user.uid ? 'Your Story' : latestStory.creatorName}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
            <Camera size={40} className="text-zinc-400" />
          </div>
          <h3 className="text-xl font-bold mb-2">No Stories</h3>
          <p className="text-zinc-500 max-w-xs">Stories from people you follow will appear here.</p>
        </div>
      )}

      <AnimatePresence>
        {selectedStory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          >
            <button 
              onClick={() => setSelectedStory(null)}
              className="absolute top-6 right-6 text-white z-10 p-2 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 transition-colors"
            >
              <X size={32} />
            </button>
            
            <div className="w-full max-w-lg h-full max-h-[90vh] relative">
              {selectedStory.mediaType === 'video' ? (
                <video 
                  src={selectedStory.mediaUrl} 
                  autoPlay 
                  loop 
                  className="w-full h-full object-contain" 
                />
              ) : (
                <img 
                  src={selectedStory.mediaUrl} 
                  className="w-full h-full object-contain" 
                  referrerPolicy="no-referrer"
                />
              )}
              
              <div className="absolute top-6 left-6 flex items-center gap-3 bg-black/20 p-2 rounded-full backdrop-blur-sm">
                <img 
                  src={selectedStory.creatorPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStory.creatorName}`} 
                  className="w-10 h-10 rounded-full border-2 border-white"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="text-white font-bold">{selectedStory.creatorName}</p>
                  <p className="text-white/60 text-xs">
                    {new Date(selectedStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const SearchScreen = ({ reels, setActiveTab, onReelClick, onViewProfile }: { reels: Reel[], setActiveTab: (t: string) => void, onReelClick: (id: string) => void, onViewProfile: (uid: string) => void }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userResults, setUserResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);

  const filteredReels = reels.filter(reel => 
    reel.caption.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reel.creatorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      setUserResults([]);
      return;
    }

    const searchUsers = async () => {
      setSearching(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
          .limit(10);
        
        if (data) {
          setUserResults(data.map(d => ({
            uid: d.id,
            displayName: d.display_name,
            username: d.username || d.display_name.toLowerCase().replace(/\s/g, ''),
            email: d.email,
            photoURL: d.photo_url,
            bio: d.bio,
            isPrivate: d.is_private,
            followersCount: d.followers_count,
            followingCount: d.following_count,
            createdAt: d.created_at
          })));
        }
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setSearching(false);
      }
    };

    const timer = setTimeout(searchUsers, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 md:pl-20 min-h-screen bg-white dark:bg-black"
    >
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={20} />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search creators or reels..."
          className="w-full pl-12 pr-4 py-4 bg-zinc-100 dark:bg-zinc-900 rounded-2xl outline-none focus:ring-2 focus:ring-orange-500 transition-all"
        />
      </div>

      {searchQuery ? (
        <div className="space-y-8">
          {userResults.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Users</h3>
              <div className="space-y-4">
                {userResults.map(user => (
                  <div 
                    key={user.uid} 
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-orange-500/20">
                        <img 
                          src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                          className="w-full h-full object-cover"
                          alt={user.displayName}
                        />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{user.displayName}</p>
                        <p className="text-[10px] text-zinc-500">@{user.username}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onViewProfile(user.uid)}
                      className="px-4 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-full"
                    >
                      View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Reels</h3>
            <div className="grid grid-cols-3 gap-1">
              {filteredReels.map(reel => (
                <div 
                  key={reel.id} 
                  onClick={() => onReelClick(reel.id)}
                  className="aspect-[9/16] bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden relative group cursor-pointer"
                >
                  <video src={reel.videoUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                    <Heart size={14} fill="white" className="mr-1" /> {reel.likesCount}
                  </div>
                </div>
              ))}
            </div>
            {filteredReels.length === 0 && !searching && (
              <div className="py-12 text-center text-zinc-400 italic">No reels found for "{searchQuery}"</div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-bold mb-4">Discover Reels</h3>
            <div className="grid grid-cols-3 gap-1">
              {reels.slice(0, 9).map(reel => (
                <div 
                  key={reel.id} 
                  onClick={() => onReelClick(reel.id)}
                  className="aspect-[9/16] bg-zinc-200 dark:bg-zinc-800 rounded-lg overflow-hidden relative group cursor-pointer"
                >
                  <video src={reel.videoUrl} className="w-full h-full object-cover" autoPlay muted loop playsInline />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                    <Heart size={14} fill="white" className="mr-1" /> {reel.likesCount}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-bold mb-4">Trending in India</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-[16/9] bg-gradient-to-br from-orange-400 to-orange-600 rounded-3xl p-4 flex flex-col justify-end text-white shadow-lg shadow-orange-500/20">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Trending</span>
                <span className="text-lg font-black">#BollywoodMagic</span>
              </div>
              <div className="aspect-[16/9] bg-gradient-to-br from-green-400 to-green-600 rounded-3xl p-4 flex flex-col justify-end text-white shadow-lg shadow-green-500/20">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Trending</span>
                <span className="text-lg font-black">#CricketFever</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-bold mb-4">Suggested Creators</h3>
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-orange-500 via-white to-green-500 p-0.5">
                    <div className="w-full h-full rounded-full bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                  <span className="text-xs font-medium">Creator {i}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// --- Main App ---

// --- App Component ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReelId, setSelectedReelId] = useState<string | null>(null);
  const [viewingProfileUid, setViewingProfileUid] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<UserProfile | null>(null);
  const [isGlobalMuted, setIsGlobalMuted] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);
  const fetchUserProfile = async (u: User) => {
    if (!u) return;
    try {
      // If Supabase is not configured, fallback immediately
      if (!supabaseUrl || !supabaseAnonKey) {
        setUserProfile({
          uid: u.uid,
          displayName: u.displayName || 'User',
          email: u.email || '',
          photoURL: u.photoURL || undefined,
          bio: 'Namaste! (Supabase not configured)',
          isPrivate: false,
          followersCount: 0,
          followingCount: 0,
          createdAt: new Date().toISOString()
        });
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.uid)
        .single();
      
      if (data) {
        setUserProfile({
          uid: data.id,
          displayName: data.display_name,
          username: data.username || data.display_name.toLowerCase().replace(/\s/g, ''),
          email: data.email,
          photoURL: data.photo_url,
          bio: data.bio,
          isPrivate: data.is_private,
          followersCount: data.followers_count,
          followingCount: data.following_count,
          createdAt: data.created_at
        });
      } else if (error && error.code === 'PGRST116') {
        // Profile not found, create one
        const baseUsername = u.displayName ? u.displayName.toLowerCase().replace(/\s/g, '') : 'user' + Math.floor(Math.random() * 1000);
        const newProfile = {
          id: u.uid,
          display_name: u.displayName || 'Indian Reels User',
          username: baseUsername,
          email: u.email,
          photo_url: u.photoURL,
          bio: 'Namaste! I am new here.',
          is_private: false,
          followers_count: 0,
          following_count: 0,
          created_at: new Date().toISOString()
        };
        await supabase.from('profiles').insert([newProfile]);
        setUserProfile({
          uid: newProfile.id,
          displayName: newProfile.display_name,
          username: newProfile.username,
          email: newProfile.email || '',
          photoURL: newProfile.photo_url || undefined,
          bio: newProfile.bio,
          isPrivate: newProfile.is_private,
          followersCount: newProfile.followers_count,
          followingCount: newProfile.following_count,
          createdAt: newProfile.created_at
        });
      } else if (error) {
        throw error;
      }
    } catch (err) {
      console.error("Error fetching/creating profile:", err);
      // Fallback to auth user data so profile screen doesn't stay loading
      setUserProfile({
        uid: u.uid,
        displayName: u.displayName || 'User',
        username: u.displayName ? u.displayName.toLowerCase().replace(/\s/g, '') : 'user',
        email: u.email || '',
        photoURL: u.photoURL || undefined,
        bio: 'Namaste! (Profile loading issue)',
        isPrivate: false,
        followersCount: 0,
        followingCount: 0,
        createdAt: new Date().toISOString()
      });
    }
  };

  const fetchOtherProfile = async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      
      if (data) {
        setViewingProfile({
          uid: data.id,
          displayName: data.display_name,
          username: data.username || data.display_name.toLowerCase().replace(/\s/g, ''),
          email: data.email,
          photoURL: data.photo_url,
          bio: data.bio,
          isPrivate: data.is_private,
          followersCount: data.followers_count,
          followingCount: data.following_count,
          createdAt: data.created_at
        });
      }
    } catch (err) {
      console.error("Error fetching other profile:", err);
    }
  };

  useEffect(() => {
    if (viewingProfileUid) {
      fetchOtherProfile(viewingProfileUid);
    } else {
      setViewingProfile(null);
    }
  }, [viewingProfileUid]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        fetchUserProfile(u);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchReels = async () => {
      const { data, error } = await supabase
        .from('reels')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        setReels(data.map(r => ({
          id: r.id,
          creatorUid: r.creator_uid,
          creatorName: r.creator_name,
          creatorPhoto: r.creator_photo,
          videoUrl: r.video_url,
          caption: r.caption,
          type: r.type,
          adLink: r.ad_link,
          likesCount: r.likes_count,
          commentsCount: r.comments_count,
          isPublic: r.is_public,
          createdAt: r.created_at
        })));
      }
    };

    fetchReels();

    // Set up real-time subscription for new reels
    const channel = supabase
      .channel('reels-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reels' }, () => {
        fetchReels();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
          <motion.div 
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-4xl font-black text-orange-500"
          >
            IR
          </motion.div>
        </div>
      </ErrorBoundary>
    );
  }

  if (!user) {
    return (
      <ErrorBoundary>
        <AuthScreen />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-white dark:bg-black text-zinc-900 dark:text-white">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} user={user} />
      
      <main className={cn("flex-1", activeTab !== 'reels' && "pb-16 md:pb-0")}>
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-screen md:pl-20 max-w-lg mx-auto pb-20"
            >
              <header className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-md z-30 p-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                <h1 className="text-xl font-black tracking-tighter bg-gradient-to-r from-orange-500 via-white to-green-500 bg-clip-text text-transparent">
                  INDIANREELS
                </h1>
                <div className="flex gap-4">
                  <Heart size={24} />
                  <MessageCircle size={24} />
                </div>
              </header>
              
              <StoryBar user={user} />

              {reels.length > 0 ? (
                reels.map(reel => (
                  <PostCard 
                    key={reel.id} 
                    reel={reel} 
                    currentUser={user} 
                    isMuted={isGlobalMuted}
                    setIsMuted={setIsGlobalMuted}
                  />
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                  <PlusSquare size={64} className="text-zinc-300 mb-4" />
                  <h3 className="text-xl font-bold">No Content Yet</h3>
                  <p className="text-zinc-500">Follow creators to see their posts here!</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'reels' && (
            <motion.div 
              key="reels"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[100dvh] overflow-y-scroll snap-y snap-mandatory md:pl-20 scrollbar-hide bg-black"
            >
              {reels.length > 0 ? (
                reels.map(reel => (
                  <div 
                    key={reel.id} 
                    id={`reel-${reel.id}`}
                    className="snap-start h-[100dvh] w-full"
                  >
                    <ReelCard 
                      reel={reel} 
                      currentUser={user} 
                      isMuted={isGlobalMuted}
                      setIsMuted={setIsGlobalMuted}
                    />
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-white">
                  <Play size={64} className="text-zinc-700 mb-4" />
                  <h3 className="text-xl font-bold">No Reels Yet</h3>
                  <p className="text-zinc-500">Be the first to share a reel!</p>
                </div>
              )}
              <ReelScroller selectedId={selectedReelId} />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            (viewingProfile || userProfile) ? (
              <motion.div 
                key={viewingProfileUid || 'own-profile'}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                  <ProfileScreen 
                    userProfile={viewingProfile || userProfile!} 
                    isOwnProfile={!viewingProfileUid} 
                    currentUser={user} 
                    darkMode={darkMode}
                    setDarkMode={setDarkMode}
                    allReels={reels}
                    onReelClick={(id) => {
                      setSelectedReelId(id);
                      setActiveTab('reels');
                    }}
                    refreshProfile={() => {
                      if (viewingProfileUid) {
                        setViewingProfileUid(null);
                      } else {
                        user && fetchUserProfile(user);
                      }
                    }}
                  />
              </motion.div>
            ) : (
              <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )
          )}

          {activeTab === 'upload' && (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <UploadScreen user={user} onComplete={() => setActiveTab('home')} />
            </motion.div>
          )}

          {activeTab === 'search' && (
            <SearchScreen 
              reels={reels} 
              setActiveTab={setActiveTab} 
              onReelClick={(id) => {
                setSelectedReelId(id);
                setActiveTab('reels');
              }}
              onViewProfile={(uid) => {
                setViewingProfileUid(uid);
                setActiveTab('profile');
              }}
            />
          )}

          {activeTab === 'stories' && user && (
            <StoriesScreen user={user} />
          )}
        </AnimatePresence>
      </main>
    </div>
    </ErrorBoundary>
  );
}
