/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, CheckCircle2, XCircle, RefreshCw, Play, Image as ImageIcon, ArrowRight, Trash2, Shuffle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { get, set, clear } from 'idb-keyval';

interface Student {
  id: string;
  name: string;
  number: string | null;
  url: string;
  file: File;
}

type GameState = 'setup' | 'playing' | 'finished';

export default function App() {
  const [students, setStudents] = useState<Student[]>([]);
  const [gameState, setGameState] = useState<GameState>('setup');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 앱 로드 시 IndexedDB에서 저장된 학생 데이터 불러오기
    get('students').then((storedStudents: any[]) => {
      if (storedStudents && storedStudents.length > 0) {
        const loaded = storedStudents.map(s => ({
          ...s,
          url: URL.createObjectURL(s.file)
        }));
        setStudents(loaded);
      }
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  const saveToDB = async (newStudents: Student[]) => {
    // url은 브라우저 세션에 종속적이므로 제외하고 저장
    const toStore = newStudents.map(({ id, name, number, file }) => ({ id, name, number, file }));
    await set('students', toStore);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const newStudents: Student[] = [];
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const baseName = file.name.replace(/\.[^/.]+$/, "").trim();
      let name = baseName;
      let number = null;

      // 정규식: (번호)이름 또는 이름(번호) 파싱
      const match1 = baseName.match(/^\((\d+)\)\s*(.+)$/);
      const match2 = baseName.match(/^(.+?)\s*\((\d+)\)$/);

      if (match1) {
        number = match1[1];
        name = match1[2].trim();
      } else if (match2) {
        name = match2[1].trim();
        number = match2[2];
      }

      newStudents.push({
        id: Math.random().toString(36).substring(7),
        name,
        number,
        url: URL.createObjectURL(file),
        file
      });
    });

    // 기존 URL 해제 및 새로운 데이터로 완전히 교체 (초기화 요구사항)
    students.forEach(s => URL.revokeObjectURL(s.url));
    setStudents(newStudents);
    await saveToDB(newStudents);
  };

  const removeStudent = (id: string) => {
    setStudents(prev => {
      const student = prev.find(s => s.id === id);
      if (student) URL.revokeObjectURL(student.url);
      const updated = prev.filter(s => s.id !== id);
      saveToDB(updated);
      return updated;
    });
  };

  const shuffleStudents = () => {
    setStudents(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      saveToDB(shuffled);
      return shuffled;
    });
  };

  const startGame = () => {
    if (students.length === 0) return;
    // 게임 시작 시 학생 순서 섞기
    shuffleStudents();
    setCurrentIndex(0);
    setScore(0);
    setGameState('playing');
  };

  const generateOptions = (correctName: string, allStudents: Student[]) => {
    const uniqueNames = Array.from(new Set(allStudents.map(s => s.name)));
    const otherNames = uniqueNames.filter(n => n !== correctName);
    const shuffledOthers = otherNames.sort(() => 0.5 - Math.random());
    const wrongOptions = shuffledOthers.slice(0, 3);
    const finalOptions = [...wrongOptions, correctName].sort(() => 0.5 - Math.random());
    setOptions(finalOptions);
  };

  useEffect(() => {
    if (gameState === 'playing' && students[currentIndex]) {
      generateOptions(students[currentIndex].name, students);
      setTextInput('');
      setFeedback(null);
    }
  }, [currentIndex, gameState, students]);

  const handleGuess = (guess: string) => {
    if (feedback) return;
    
    const currentStudent = students[currentIndex];
    const isCorrect = guess.trim().toLowerCase() === currentStudent.name.toLowerCase();
    
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    if (isCorrect) setScore(s => s + 1);

    setTimeout(() => {
      if (currentIndex + 1 < students.length) {
        setCurrentIndex(i => i + 1);
      } else {
        setGameState('finished');
      }
    }, 1500);
  };

  const resetApp = async () => {
    students.forEach(s => URL.revokeObjectURL(s.url));
    setStudents([]);
    setGameState('setup');
    setScore(0);
    setCurrentIndex(0);
    await clear();
  };

  const playAgain = () => {
    shuffleStudents();
    setGameState('playing');
    setScore(0);
    setCurrentIndex(0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ImageIcon className="text-indigo-600" />
            학생 이름 맞추기
          </h1>
          {gameState !== 'setup' && (
            <button 
              onClick={resetApp}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={16} /> 처음으로
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {gameState === 'setup' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="text-center max-w-2xl mx-auto space-y-4 py-8">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">사진을 업로드하고 게임을 시작하세요</h2>
              <p className="text-slate-600 text-lg">
                파일명이 <code className="bg-slate-100 px-2 py-1 rounded text-indigo-600 text-sm font-mono">이름(번호).jpg</code> 또는 <code className="bg-slate-100 px-2 py-1 rounded text-indigo-600 text-sm font-mono">(번호)이름.png</code> 형식인 사진들을 올려주세요. 자동으로 이름을 추출합니다.
              </p>
            </div>

            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-200 ${
                isDragging ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <UploadCloud size={40} />
              </div>
              <h3 className="text-xl font-semibold mb-2">클릭하거나 사진을 이곳에 드롭하세요</h3>
              <p className="text-slate-500">여러 장의 사진을 한 번에 선택할 수 있습니다 (권장: 10~25장)</p>
            </div>

            {students.length > 0 && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    업로드된 학생 목록 <span className="bg-indigo-100 text-indigo-700 py-0.5 px-2.5 rounded-full text-sm">{students.length}명</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={shuffleStudents}
                      className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <Shuffle size={18} /> 순서 섞기
                    </button>
                    <button 
                      onClick={startGame}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors shadow-sm"
                    >
                      <Play size={18} /> 게임 시작하기
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {students.map(student => (
                    <div key={student.id} className="group relative bg-slate-50 rounded-xl overflow-hidden border border-slate-200 aspect-square">
                      <img src={student.url} alt={student.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                        <p className="text-white font-medium truncate">{student.name}</p>
                        {student.number && <p className="text-white/80 text-xs">번호: {student.number}</p>}
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeStudent(student.id); }}
                        className="absolute top-2 right-2 bg-white/90 text-rose-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-rose-500 hover:text-white transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {gameState === 'playing' && students[currentIndex] && (
          <motion.div 
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-2xl mx-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <div className="bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200 text-sm font-semibold text-slate-600">
                문제 {currentIndex + 1} <span className="text-slate-400 font-normal">/ {students.length}</span>
              </div>
              <div className="bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 text-sm font-semibold text-indigo-700">
                점수: {score}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8 relative">
              <div className="aspect-square sm:aspect-[4/3] bg-slate-100 relative flex items-center justify-center p-4">
                <img 
                  src={students[currentIndex].url} 
                  alt="Student" 
                  className="max-w-full max-h-full object-contain rounded-xl shadow-sm"
                />
                
                <AnimatePresence>
                  {feedback && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className={`absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-10 ${feedback === 'correct' ? 'text-emerald-500' : 'text-rose-500'}`}
                    >
                      <div className="text-center">
                        {feedback === 'correct' ? (
                          <CheckCircle2 size={120} className="mx-auto mb-4 drop-shadow-lg" />
                        ) : (
                          <XCircle size={120} className="mx-auto mb-4 drop-shadow-lg" />
                        )}
                        <p className="text-3xl font-bold text-slate-800">
                          {feedback === 'correct' ? '정답입니다!' : `정답은 '${students[currentIndex].name}'`}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleGuess(textInput); }} className="mb-6 flex gap-3">
              <input 
                type="text" 
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="이름을 직접 입력하세요..."
                className="flex-1 px-5 py-4 rounded-2xl border-2 border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-lg transition-all"
                disabled={!!feedback}
                autoFocus
              />
              <button 
                type="submit"
                disabled={!!feedback || !textInput.trim()}
                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 flex items-center gap-2 transition-all shadow-sm hover:shadow"
              >
                확인 <ArrowRight size={20} />
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center mb-6">
                <span className="bg-slate-50 px-4 text-sm text-slate-500">또는 보기에서 선택</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleGuess(opt)}
                  disabled={!!feedback}
                  className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-lg font-medium text-slate-700 disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent bg-white shadow-sm hover:shadow"
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {gameState === 'finished' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-lg mx-auto text-center bg-white rounded-3xl shadow-sm border border-slate-200 p-10 mt-12"
          >
            <div className="w-24 h-24 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-2">게임 종료!</h2>
            <p className="text-slate-500 text-lg mb-8">모든 학생의 사진을 확인했습니다.</p>
            
            <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-100">
              <p className="text-sm font-medium text-slate-500 mb-1">최종 점수</p>
              <div className="text-5xl font-black text-indigo-600">
                {score} <span className="text-2xl text-slate-400 font-bold">/ {students.length}</span>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button 
                onClick={playAgain}
                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 transition-all shadow-sm hover:shadow flex items-center gap-2"
              >
                <RefreshCw size={20} /> 다시 하기
              </button>
              <button 
                onClick={resetApp}
                className="px-8 py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-2xl font-semibold hover:bg-slate-50 transition-all flex items-center gap-2"
              >
                새로운 사진 올리기
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
