import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAchb2swC3EmqAIuia-iC6mS5LJtY1mGAc",
  authDomain: "sonsan-app.firebaseapp.com",
  projectId: "sonsan-app",
  storageBucket: "sonsan-app.firebasestorage.app",
  messagingSenderId: "984854628356",
  appId: "1:984854628356:web:964d9fe6d344cfe161cd51",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 확인된 JavaScript 대표 키
const KAKAO_KEY = "4080c5f3d9bb80450755ae2530fd2fef";

export default function App() {
  const [surveys, setSurveys] = useState([]);
  const [activeSurveyId, setActiveSurveyId] = useState(null);
  const [viewMode, setViewMode] = useState("dashboard");

  const [editingResponseId, setEditingResponseId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [adultCount, setAdultCount] = useState(0);
  const [childCount, setChildCount] = useState(0);
  const [adultTypes, setAdultTypes] = useState({
    엄마: false,
    아빠: false,
    기타: false,
  });
  const [memo, setMemo] = useState(""); // ✨ 새롭게 추가된 메모 상태

  const [newTitle, setNewTitle] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newDeadlineTime, setNewDeadlineTime] = useState("23:59");
  const [newEventDate, setNewEventDate] = useState("");
  const [newTargetCount, setNewTargetCount] = useState(11);
  const [isEditingEvent, setIsEditingEvent] = useState(false);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!document.getElementById("kakao-js-sdk")) {
      const script = document.createElement("script");
      script.id = "kakao-js-sdk";
      script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
      script.integrity = "sha384-TiCmbV6AUnR+Nq+OluFQ/5JCk013iH6O/oEWP/8H2QhK/XbZk0mP/E/f6N6b9zB+";
      script.crossOrigin = "anonymous";
      
      script.onload = () => {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(KAKAO_KEY);
        }
      };
      document.head.appendChild(script);
    } else {
      if (window.Kakao && !window.Kakao.isInitialized()) {
        window.Kakao.init(KAKAO_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "surveys"), (snapshot) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const loadedSurveys = snapshot.docs
        .map((document) => {
          const data = document.data();
          const deadlineDate = new Date(data.deadline);
          if (data.deadlineTime) {
            const [hh, mm] = data.deadlineTime.split(":");
            deadlineDate.setHours(hh, mm, 0, 0);
          } else {
            deadlineDate.setHours(23, 59, 59, 999);
          }

          const archiveThreshold = new Date(deadlineDate);
          archiveThreshold.setDate(archiveThreshold.getDate() + 3);

          const deleteThreshold = new Date(deadlineDate);
          deleteThreshold.setFullYear(deleteThreshold.getFullYear() + 1);

          return {
            id: document.id,
            ...data,
            isArchived: today > archiveThreshold,
            toBeDeleted: today > deleteThreshold,
          };
        })
        .filter((s) => !s.toBeDeleted);

      loadedSurveys.sort((a, b) => b.createdAt - a.createdAt);
      setSurveys(loadedSurveys);
    });

    return () => unsubscribe();
  }, []);

  const currentSurvey = surveys.find((s) => s.id === activeSurveyId);

  const getTimeLeftText = (deadline, deadlineTime) => {
    if (!deadline) return "";
    const deadlineDate = new Date(deadline);
    if (deadlineTime) {
      const [hh, mm] = deadlineTime.split(":");
      deadlineDate.setHours(hh, mm, 0, 0);
    } else {
      deadlineDate.setHours(23, 59, 59, 999);
    }

    const diff = deadlineDate - currentTime;
    if (diff <= 0) return "마감되었습니다";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);

    let text = "";
    if (days > 0) text += `${days}일 `;
    if (hours > 0) text += `${hours}시간 `;
    text += `${mins}분 남음 ⏳`;

    return text;
  };

  const getAutoIcon = (title) => {
    if (title.includes("소풍") || title.includes("현장학습")) return "🍱";
    if (title.includes("운동회") || title.includes("체육")) return "🏃‍♂️";
    if (title.includes("총회") || title.includes("간담회") || title.includes("회의")) return "☕";
    if (title.includes("참관") || title.includes("수업") || title.includes("교사")) return "👩‍🏫";
    if (title.includes("급식")) return "🍚";
    return "📋";
  };

  const handleSaveSurvey = async () => {
    if (!newTitle || !newDeadline || !newEventDate || !newTargetCount) return alert("모든 항목을 입력해주세요.");
    try {
      if (isEditingEvent) {
        await updateDoc(doc(db, "surveys", activeSurveyId), { 
          title: newTitle, 
          deadline: newDeadline, 
          deadlineTime: newDeadlineTime,
          eventDate: newEventDate, 
          targetFamilyCount: Number(newTargetCount), 
          icon: getAutoIcon(newTitle) 
        });
        setIsEditingEvent(false);
        setViewMode("survey");
      } else {
        await addDoc(collection(db, "surveys"), { 
          title: newTitle, 
          deadline: newDeadline, 
          deadlineTime: newDeadlineTime,
          eventDate: newEventDate, 
          targetFamilyCount: Number(newTargetCount), 
          icon: getAutoIcon(newTitle), 
          responses: [], 
          createdAt: Date.now() 
        });
        setViewMode("dashboard");
      }
      setNewTitle(""); setNewDeadline(""); setNewDeadlineTime("23:59"); setNewEventDate(""); setNewTargetCount(11);
    } catch (e) { alert("오류가 발생했습니다."); }
  };

  const handleDeleteSurvey = async (id) => {
    if (window.confirm("이 참석자 조사 데이터를 영구적으로 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "surveys", id));
      if (viewMode === "survey" || viewMode === "historyDetail") setViewMode("dashboard");
    }
  };

  // ✨ 참석자 제출 및 에러 검증 로직
  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!studentName) return alert("학생 이름을 입력해주세요.");

    // ✨ 어른 인원수 vs 체크박스 개수 검증
    const selectedTypesCount = Object.values(adultTypes).filter(Boolean).length;
    
    if (adultCount > 0 && selectedTypesCount !== adultCount) {
      return alert(`❌ 어른 인원수(${adultCount}명)와 선택한 체크박스 항목(${selectedTypesCount}개)이 일치하지 않습니다.\n인원수에 맞게 엄마/아빠/기타를 정확히 체크해주세요.`);
    }
    if (adultCount === 0 && selectedTypesCount > 0) {
      return alert("❌ 어른 인원이 0명일 경우 체크박스를 모두 해제해주세요.");
    }

    const selectedTypes = Object.entries(adultTypes).filter(([_, v]) => v).map(([k]) => k).join(", ");
    let updatedResponses = [...(currentSurvey.responses || [])];

    if (editingResponseId) {
      updatedResponses = updatedResponses.map((r) => r.id === editingResponseId ? { ...r, studentName, adultCount, childCount, adultTypes: selectedTypes, memo } : r);
      await updateDoc(doc(db, "surveys", activeSurveyId), { responses: updatedResponses });
      setEditingResponseId(null);
      alert("수정되었습니다.");
    } else {
      updatedResponses = [{ id: Date.now(), studentName, adultCount, childCount, adultTypes: selectedTypes, memo }, ...updatedResponses];
      await updateDoc(doc(db, "surveys", activeSurveyId), { responses: updatedResponses });
      alert("제출되었습니다.");
    }
    
    // 입력창 초기화
    setStudentName(""); 
    setAdultCount(0); 
    setChildCount(0); 
    setAdultTypes({ 엄마: false, 아빠: false, 기타: false });
    setMemo(""); // 메모 초기화
  };

  const handleDeleteResponse = async (responseId) => {
    if (window.confirm("해당 학생의 참석 정보를 명단에서 삭제하시겠습니까?")) {
      const updatedResponses = currentSurvey.responses.filter((r) => r.id !== responseId);
      await updateDoc(doc(db, "surveys", activeSurveyId), { responses: updatedResponses });
    }
  };

  const sendKakaoMessage = () => {
    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(KAKAO_KEY);
    }
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: "송산초 학부모 알림이",
        description: "새로운 행사 참석자 조사가 있습니다. 아래 버튼을 눌러 인원을 알려주세요!",
        imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop",
        link: { mobileWebUrl: "https://wizardly-breeze-9m6fxn.vercel.app/", webUrl: "https://wizardly-breeze-9m6fxn.vercel.app/" },
      },
      buttons: [{ title: "참석 인원 입력하기 📝", link: { mobileWebUrl: "https://wizardly-breeze-9m6fxn.vercel.app/", webUrl: "https://wizardly-breeze-9m6fxn.vercel.app/" } }],
    });
  };

  const handleShareToKakao = () => {
    if (window.Kakao) {
      sendKakaoMessage();
    } else {
      const script = document.createElement("script");
      script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";
      script.onload = () => sendKakaoMessage();
      document.head.appendChild(script);
    }
  };

  // ✨ 합계 상세 계산 로직 (엄마/아빠 구분 추가)
  const calculateTotals = (responses = []) => {
    const adults = responses.reduce((s, r) => s + r.adultCount, 0);
    const children = responses.reduce((s, r) => s + r.childCount, 0);
    
    let moms = 0;
    let dads = 0;
    responses.forEach(r => {
      if (r.adultTypes && r.adultTypes.includes("엄마")) moms++;
      if (r.adultTypes && r.adultTypes.includes("아빠")) dads++;
    });

    return { adults, children, total: adults + children, moms, dads };
  };

  const styles = {
    container: { maxWidth: "420px", margin: "0 auto", padding: "20px", backgroundColor: "#FFFBF5", minHeight: "100vh", fontFamily: "sans-serif" },
    card: { backgroundColor: "white", padding: "15px", borderRadius: "12px", marginBottom: "15px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" },
    input: { width: "100%", padding: "12px", border: "1px solid #FED7AA", borderRadius: "8px", boxSizing: "border-box", marginBottom: "10px", fontSize: "0.95rem" },
    primaryBtn: { width: "100%", padding: "15px", backgroundColor: "#EA580C", color: "white", border: "none", borderRadius: "10px", fontWeight: "bold", cursor: "pointer", fontSize: "1rem" },
    actionBtn: { fontSize: "0.75rem", padding: "4px 8px", marginLeft: "5px", borderRadius: "6px", border: "1px solid #FED7AA", backgroundColor: "#FFF7ED", color: "#EA580C", cursor: "pointer" },
    deleteBtn: { fontSize: "0.75rem", padding: "4px 8px", marginLeft: "5px", borderRadius: "6px", border: "1px solid #FECACA", backgroundColor: "#FEF2F2", color: "#DC2626", cursor: "pointer" },
    kakaoBtn: { width: "100%", padding: "14px", backgroundColor: "#FEE500", color: "#3C1E1E", border: "none", borderRadius: "12px", fontWeight: "bold", fontSize: "1rem", cursor: "pointer", marginBottom: "25px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" },
  };

  return (
    <div style={styles.container}>
      {/* 1. 메인 대시보드 */}
      {viewMode === "dashboard" && (
        <>
          <div style={{ textAlign: "center", marginBottom: "20px" }}>
            <h2 style={{ color: "#9A3412" }}>송산초 학부모 알림이</h2>
          </div>

          <button style={styles.kakaoBtn} onClick={handleShareToKakao}>
            💬 카카오톡 공유하기
          </button>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <div style={{ backgroundColor: "#FFEDD5", border: "2px dashed #FDBA74", padding: "20px", borderRadius: "16px", textAlign: "center", cursor: "pointer" }} onClick={() => { setIsEditingEvent(false); setNewTargetCount(11); setViewMode("create"); }}>
              <div style={{ fontSize: "2rem", color: "#EA580C" }}>+</div>
              <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>새 참석자 조사</div>
            </div>
            {surveys.filter((s) => !s.isArchived).map((s) => (
              <div key={s.id} style={{ backgroundColor: "white", padding: "20px", borderRadius: "16px", textAlign: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.05)", cursor: "pointer" }} onClick={() => { setActiveSurveyId(s.id); setViewMode("survey"); }}>
                <div style={{ fontSize: "3rem", marginBottom: "10px" }}>{s.icon}</div>
                <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>{s.title}</div>
              </div>
            ))}
          </div>
          <button style={{ width: "100%", marginTop: "40px", background: "none", border: "none", color: "#EA580C", textDecoration: "underline", cursor: "pointer" }} onClick={() => setViewMode("history")}>
            지난 참석자 조사 이력 보기
          </button>
        </>
      )}

      {/* 2. 행사 만들기/수정하기 화면 */}
      {viewMode === "create" && (
        <div>
          <button onClick={() => setViewMode(isEditingEvent ? "survey" : "dashboard")} style={{ border: "none", background: "none", color: "#EA580C", fontWeight: "bold", cursor: "pointer", paddingBottom: "10px" }}>◀ 뒤로</button>
          <h2 style={{ color: "#9A3412", marginTop: 0 }}>{isEditingEvent ? "행사 수정" : "새 조사 만들기"}</h2>
          <div style={styles.card}>
            <label style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666" }}>제목</label>
            <input style={styles.input} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <label style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666" }}>마감일</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <input type="date" style={{ ...styles.input, flex: 2 }} value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
              <input type="time" style={{ ...styles.input, flex: 1 }} value={newDeadlineTime} onChange={(e) => setNewDeadlineTime(e.target.value)} />
            </div>
            <label style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666" }}>행사일시</label>
            <input style={styles.input} value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} />
            <label style={{ fontSize: "0.9rem", fontWeight: "bold", color: "#666" }}>대상 가족 수</label>
            <input type="number" style={styles.input} value={newTargetCount} onChange={(e) => setNewTargetCount(e.target.value)} />
          </div>
          <button style={styles.primaryBtn} onClick={handleSaveSurvey}>저장하기</button>
        </div>
      )}

      {/* 3. 명단 입력 & 확인 화면 */}
      {viewMode === "survey" && currentSurvey && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => setViewMode("dashboard")} style={{ border: "none", background: "none", color: "#EA580C", fontWeight: "bold", cursor: "pointer", padding: "10px 0" }}>◀ 대시보드</button>
            <div>
              <button onClick={() => { setIsEditingEvent(true); setNewTitle(currentSurvey.title); setNewDeadline(currentSurvey.deadline); setNewDeadlineTime(currentSurvey.deadlineTime || "23:59"); setNewEventDate(currentSurvey.eventDate); setNewTargetCount(currentSurvey.targetFamilyCount); setViewMode("create"); }} style={styles.actionBtn}>⚙️ 행사수정</button>
              <button onClick={() => handleDeleteSurvey(currentSurvey.id)} style={styles.deleteBtn}>🗑️ 조사삭제</button>
            </div>
          </div>

          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <h2 style={{ margin: "0 0 15px 0" }}>{currentSurvey.title}</h2>
            <div style={{ backgroundColor: "white", padding: "15px", borderRadius: "12px", display: "inline-block", textAlign: "left", lineHeight: "1.6", border: "1px solid #FFEDD5" }}>
              <div style={{ fontSize: "0.85rem", color: "#666" }}><strong>조사 기한 :</strong> {currentSurvey.deadline} {currentSurvey.deadlineTime || "23:59"}까지</div>
              <div style={{ fontSize: "0.95rem", color: "#DC2626", fontWeight: "bold" }}>{getTimeLeftText(currentSurvey.deadline, currentSurvey.deadlineTime)}</div>
              <div style={{ fontSize: "0.85rem", color: "#666", marginTop: "5px" }}><strong>행사 일시 :</strong> {currentSurvey.eventDate}</div>
            </div>
          </div>

          {/* ✨ 입력 폼 */}
          <div style={{ ...styles.card, border: editingResponseId ? "2px solid #EA580C" : "none" }}>
            {editingResponseId && <div style={{ color: "#EA580C", fontWeight: "bold", marginBottom: "10px" }}>✏️ 수정 중</div>}
            
            <input style={styles.input} value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="학생 이름" />
            
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <span>어른: {adultCount}</span>
              <div><button onClick={() => setAdultCount(Math.max(0, adultCount - 1))}>-</button> <button onClick={() => setAdultCount(adultCount + 1)}>+</button></div>
            </div>
            
            {/* 체크박스 영역 */}
            {adultCount > 0 && (
              <div style={{ display: "flex", gap: "10px", fontSize: "0.8rem", backgroundColor: "#FFF7ED", padding: "10px", borderRadius: "8px", marginBottom: "10px" }}>
                {["엄마", "아빠", "기타"].map((t) => (
                  <label key={t}><input type="checkbox" checked={adultTypes[t]} onChange={() => setAdultTypes({ ...adultTypes, [t]: !adultTypes[t] })} />{t} </label>
                ))}
              </div>
            )}
            
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "15px", marginBottom: "15px" }}>
              <span>아이: {childCount}</span>
              <div><button onClick={() => setChildCount(Math.max(0, childCount - 1))}>-</button> <button onClick={() => setChildCount(childCount + 1)}>+</button></div>
            </div>

            {/* ✨ 메모 입력칸 추가 */}
            <input 
              style={{ ...styles.input, marginBottom: "0", fontSize: "0.85rem", backgroundColor: "#F9FAFB", borderColor: "#E5E7EB" }} 
              value={memo} 
              onChange={(e) => setMemo(e.target.value)} 
              placeholder="메모를 입력하세요(지각, 고학년 신청 등)" 
            />
          </div>
          
          <button style={styles.primaryBtn} onClick={handleSubmitResponse}>{editingResponseId ? "수정 완료" : "제출하기"}</button>

          {/* ✨ 실시간 명단 표시 */}
          <div style={{ marginTop: "30px" }}>
            <h4 style={{ color: "#9A3412", borderBottom: "2px solid #FFEDD5", paddingBottom: "10px", marginBottom: "15px" }}>
              실시간 명단 <span style={{ fontSize: "0.8rem", fontWeight: "normal", color: "#EA580C", display: "block", marginTop: "5px" }}>(제출 {currentSurvey.responses.length}가족 / 미제출 {Math.max(0, currentSurvey.targetFamilyCount - currentSurvey.responses.length)}가족)</span>
            </h4>
            
            {/* ✨ 변경된 합계 표시 */}
            <div style={{ fontSize: "0.85rem", color: "#9A3412", fontWeight: "bold", backgroundColor: "#FFEDD5", padding: "10px", borderRadius: "8px", marginBottom: "15px" }}>
              어른 {calculateTotals(currentSurvey.responses).adults}명(엄마 {calculateTotals(currentSurvey.responses).moms}명, 아빠 {calculateTotals(currentSurvey.responses).dads}명), 아이 {calculateTotals(currentSurvey.responses).children}명 [총 {calculateTotals(currentSurvey.responses).total}명]
            </div>

            {currentSurvey.responses.map((r) => (
              <div key={r.id} style={{ padding: "12px 0", borderBottom: "1px solid #EEE", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: "0.9rem", marginBottom: "5px" }}>
                    <strong>{r.studentName}</strong> 
                    <span style={{ fontSize: "0.8rem", color: "#666", marginLeft: "5px" }}>
                      | {r.adultCount > 0 ? `어른 ${r.adultCount}명(${r.adultTypes})` : "어른 0명"}, 아이 {r.childCount}명
                    </span>
                  </div>
                  {/* ✨ 입력한 메모가 예쁘게 출력되도록 UI 추가 */}
                  {r.memo && (
                    <div style={{ fontSize: "0.75rem", color: "#6B7280", backgroundColor: "#F3F4F6", padding: "4px 8px", borderRadius: "4px", display: "inline-block" }}>
                      📝 {r.memo}
                    </div>
                  )}
                </div>
                <div style={{ whiteSpace: "nowrap", marginLeft: "10px" }}>
                  <button style={styles.actionBtn} onClick={() => { 
                    setStudentName(r.studentName); 
                    setAdultCount(r.adultCount); 
                    setChildCount(r.childCount); 
                    setMemo(r.memo || ""); // 수정 시 기존 메모 불러오기
                    const savedTypes = r.adultTypes || "";
                    setAdultTypes({ 
                      엄마: savedTypes.includes("엄마"), 
                      아빠: savedTypes.includes("아빠"), 
                      기타: savedTypes.includes("기타") 
                    });
                    setEditingResponseId(r.id); 
                    window.scrollTo({ top: 0, behavior: "smooth" }); 
                  }}>수정</button>
                  <button style={styles.deleteBtn} onClick={() => handleDeleteResponse(r.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. 이력 보기 */}
      {viewMode === "history" && (
        <div>
          <button onClick={() => setViewMode("dashboard")} style={{ border: "none", background: "none", color: "#EA580C", fontWeight: "bold", cursor: "pointer", paddingBottom: "10px" }}>◀ 돌아가기</button>
          <h2 style={{ color: "#9A3412", marginTop: 0 }}>지난 조사 이력</h2>
          {surveys.filter((s) => s.isArchived).map((s) => (
            <div key={s.id} style={{ ...styles.card, borderLeft: "4px solid #FDBA74", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div onClick={() => { setActiveSurveyId(s.id); setViewMode("historyDetail"); }} style={{ cursor: "pointer", flex: 1 }}>
                <div style={{ fontWeight: "bold" }}>{s.title}</div>
                <div style={{ fontSize: "0.75rem", color: "#999" }}>{s.deadline} 마감</div>
              </div>
              <button style={{ background: "none", border: "none", color: "#DC2626", textDecoration: "underline", fontSize: "0.8rem", cursor: "pointer" }} onClick={() => handleDeleteSurvey(s.id)}>삭제</button>
            </div>
          ))}
        </div>
      )}

      {/* 5. 이력 상세 */}
      {viewMode === "historyDetail" && currentSurvey && (
        <div>
          <button onClick={() => setViewMode("history")} style={{ border: "none", background: "none", color: "#EA580C", fontWeight: "bold", cursor: "pointer", paddingBottom: "10px" }}>◀ 목록으로</button>
          <div style={styles.card}>
            <h3 style={{ marginTop: 0 }}>{currentSurvey.title} (마감됨)</h3>
            
            {/* ✨ 이력 화면에도 동일한 합계 텍스트 적용 */}
            <div style={{ fontSize: "0.85rem", color: "#9A3412", fontWeight: "bold", backgroundColor: "#FFEDD5", padding: "10px", borderRadius: "8px", margin: "10px 0" }}>
              어른 {calculateTotals(currentSurvey.responses).adults}명(엄마 {calculateTotals(currentSurvey.responses).moms}명, 아빠 {calculateTotals(currentSurvey.responses).dads}명), 아이 {calculateTotals(currentSurvey.responses).children}명 [총 {calculateTotals(currentSurvey.responses).total}명]
            </div>
            
            <hr style={{ border: "0.5px solid #EEE", margin: "15px 0" }} />
            
            {currentSurvey.responses.map((r) => (
              <div key={r.id} style={{ padding: "8px 0", borderBottom: "1px solid #EEE", fontSize: "0.85rem" }}>
                <div>
                  <strong>{r.studentName}</strong>: {r.adultCount > 0 ? `어른 ${r.adultCount}명(${r.adultTypes})` : "어른 0명"} / 아이 {r.childCount}명
                </div>
                {r.memo && <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "3px" }}>📝 {r.memo}</div>}
              </div>
            ))}
          </div>
          <button style={{ ...styles.primaryBtn, backgroundColor: "#DC2626" }} onClick={() => handleDeleteSurvey(currentSurvey.id)}>이 이력 완전히 삭제하기</button>
        </div>
      )}
    </div>
  );
}
