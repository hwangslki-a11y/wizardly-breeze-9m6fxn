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

// 올려주신 화면의 파이어베이스 열쇠(Config)
const firebaseConfig = {
  apiKey: "AIzaSyAchb2swC3EmqAIuia-iC6mS5LJtY1mGAc",
  authDomain: "sonsan-app.firebaseapp.com",
  projectId: "sonsan-app",
  storageBucket: "sonsan-app.firebasestorage.app",
  messagingSenderId: "984854628356",
  appId: "1:984854628356:web:964d9fe6d344cfe161cd51",
};

// 파이어베이스 및 데이터베이스 실행
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function App() {
  // --- 상태 관리 ---
  const [surveys, setSurveys] = useState([]);
  const [activeSurveyId, setActiveSurveyId] = useState(null);
  const [viewMode, setViewMode] = useState("dashboard"); // dashboard, create, survey, history, historyDetail

  // 입력 폼 상태 (학부모 응답용)
  const [editingResponseId, setEditingResponseId] = useState(null);
  const [studentName, setStudentName] = useState("");
  const [adultCount, setAdultCount] = useState(0);
  const [childCount, setChildCount] = useState(0);
  const [adultTypes, setAdultTypes] = useState({
    엄마: false,
    아빠: false,
    기타: false,
  });

  // 폼 상태 (관리자 행사 생성/수정용)
  const [newTitle, setNewTitle] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newEventDate, setNewEventDate] = useState("");
  const [newTargetCount, setNewTargetCount] = useState(11);
  const [isEditingEvent, setIsEditingEvent] = useState(false);

  // --- 실시간 데이터베이스 연동 로직 ---
  useEffect(() => {
    // DB의 'surveys' 공간에서 데이터를 실시간으로 가져옴
    const unsubscribe = onSnapshot(collection(db, "surveys"), (snapshot) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const loadedSurveys = snapshot.docs
        .map((document) => {
          const data = document.data();
          const deadlineDate = new Date(data.deadline);
          deadlineDate.setHours(23, 59, 59, 999);

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
        .filter((s) => !s.toBeDeleted); // 1년 지난 데이터는 화면에서 제외

      // 작성 시간순으로 정렬해서 보여주기
      loadedSurveys.sort((a, b) => b.createdAt - a.createdAt);
      setSurveys(loadedSurveys);
    });

    return () => unsubscribe(); // 앱 종료 시 연결 해제
  }, []);

  const currentSurvey = surveys.find((s) => s.id === activeSurveyId);

  // --- 함수: 자동 아이콘 ---
  const getAutoIcon = (title) => {
    if (title.includes("소풍") || title.includes("현장학습")) return "🍱";
    if (title.includes("운동회") || title.includes("체육")) return "🏃‍♂️";
    if (
      title.includes("총회") ||
      title.includes("간담회") ||
      title.includes("회의")
    )
      return "☕";
    if (
      title.includes("참관") ||
      title.includes("수업") ||
      title.includes("교사")
    )
      return "👩‍🏫";
    if (title.includes("급식")) return "🍚";
    return "📋";
  };

  // --- 함수: 행사 생성 및 수정 (DB 저장) ---
  const handleSaveSurvey = async () => {
    if (!newTitle || !newDeadline || !newEventDate || !newTargetCount)
      return alert("모든 항목을 입력해주세요.");

    try {
      if (isEditingEvent) {
        await updateDoc(doc(db, "surveys", activeSurveyId), {
          title: newTitle,
          deadline: newDeadline,
          eventDate: newEventDate,
          targetFamilyCount: Number(newTargetCount),
          icon: getAutoIcon(newTitle),
        });
        setIsEditingEvent(false);
        setViewMode("survey");
      } else {
        await addDoc(collection(db, "surveys"), {
          title: newTitle,
          deadline: newDeadline,
          eventDate: newEventDate,
          targetFamilyCount: Number(newTargetCount),
          icon: getAutoIcon(newTitle),
          responses: [],
          createdAt: Date.now(),
        });
        setViewMode("dashboard");
      }
      setNewTitle("");
      setNewDeadline("");
      setNewEventDate("");
      setNewTargetCount(11);
    } catch (error) {
      alert("데이터 저장 중 오류가 발생했습니다.");
      console.error(error);
    }
  };

  const openEditEvent = () => {
    setNewTitle(currentSurvey.title);
    setNewDeadline(currentSurvey.deadline);
    setNewEventDate(currentSurvey.eventDate);
    setNewTargetCount(currentSurvey.targetFamilyCount || 11);
    setIsEditingEvent(true);
    setViewMode("create");
  };

  const handleDeleteSurvey = async () => {
    if (
      window.confirm(
        "이 참석자 조사를 완전히 삭제하시겠습니까? (복구할 수 없습니다)"
      )
    ) {
      await deleteDoc(doc(db, "surveys", activeSurveyId));
      setIsEditingEvent(false);
      setViewMode("dashboard");
    }
  };

  // --- 함수: 참석자 응답 제출 및 수정 (DB 업데이트) ---
  const handleSubmitResponse = async (e) => {
    e.preventDefault();
    if (!studentName) return alert("학생 이름을 입력해주세요.");
    if (adultCount === 0 && childCount === 0)
      return alert("참석 인원을 선택해주세요.");

    const selectedTypes = Object.entries(adultTypes)
      .filter(([_, checked]) => checked)
      .map(([name]) => name)
      .join(", ");
    let updatedResponses = [...(currentSurvey.responses || [])];

    if (editingResponseId) {
      updatedResponses = updatedResponses.map((r) =>
        r.id === editingResponseId
          ? {
              ...r,
              studentName,
              adultCount,
              childCount,
              adultTypes: selectedTypes,
            }
          : r
      );
      await updateDoc(doc(db, "surveys", activeSurveyId), {
        responses: updatedResponses,
      });
      setEditingResponseId(null);
      alert("수정되었습니다!");
    } else {
      const isDuplicate = updatedResponses.some(
        (r) => r.studentName === studentName
      );
      if (
        isDuplicate &&
        !window.confirm(
          "이미 같은 이름으로 제출된 내역이 있습니다. 그래도 추가하시겠습니까?"
        )
      )
        return;

      const newResponse = {
        id: Date.now(),
        studentName,
        adultCount,
        childCount,
        adultTypes: selectedTypes,
      };
      updatedResponses = [newResponse, ...updatedResponses];
      await updateDoc(doc(db, "surveys", activeSurveyId), {
        responses: updatedResponses,
      });
      alert("제출되었습니다!");
    }

    setStudentName("");
    setAdultCount(0);
    setChildCount(0);
    setAdultTypes({ 엄마: false, 아빠: false, 기타: false });
  };

  const handleEditResponse = (response) => {
    setStudentName(response.studentName);
    setAdultCount(response.adultCount);
    setChildCount(response.childCount);
    const types = response.adultTypes.split(", ");
    setAdultTypes({
      엄마: types.includes("엄마"),
      아빠: types.includes("아빠"),
      기타: types.includes("기타"),
    });
    setEditingResponseId(response.id);
    window.scrollTo(0, 0);
  };

  const handleDeleteResponse = async (responseId) => {
    if (window.confirm("제출한 참석 정보를 삭제하시겠습니까?")) {
      const updatedResponses = currentSurvey.responses.filter(
        (r) => r.id !== responseId
      );
      await updateDoc(doc(db, "surveys", activeSurveyId), {
        responses: updatedResponses,
      });
    }
  };

  const calculateTotals = (responses = []) => {
    const adults = responses.reduce((sum, r) => sum + r.adultCount, 0);
    const children = responses.reduce((sum, r) => sum + r.childCount, 0);
    return { adults, children, total: adults + children };
  };

  // --- 스타일 ---
  const styles = {
    container: {
      maxWidth: "420px",
      margin: "0 auto",
      padding: "20px",
      backgroundColor: "#FFFBF5",
      minHeight: "100vh",
      fontFamily: "sans-serif",
    },
    iconGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "15px",
      marginTop: "15px",
    },
    iconCard: {
      backgroundColor: "white",
      padding: "20px",
      borderRadius: "16px",
      textAlign: "center",
      boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      cursor: "pointer",
    },
    createCard: {
      backgroundColor: "#FFEDD5",
      border: "2px dashed #FDBA74",
      padding: "20px",
      borderRadius: "16px",
      textAlign: "center",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
    },
    formGroup: {
      backgroundColor: "white",
      padding: "15px",
      borderRadius: "12px",
      marginBottom: "15px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
    },
    input: {
      width: "100%",
      padding: "12px",
      border: "1px solid #FED7AA",
      borderRadius: "8px",
      boxSizing: "border-box",
      marginBottom: "10px",
    },
    counterBtn: {
      width: "35px",
      height: "35px",
      borderRadius: "50%",
      border: "1px solid #FED7AA",
      backgroundColor: "white",
      color: "#EA580C",
      fontWeight: "bold",
    },
    primaryBtn: {
      width: "100%",
      padding: "15px",
      backgroundColor: "#EA580C",
      color: "white",
      border: "none",
      borderRadius: "10px",
      fontWeight: "bold",
      marginTop: "10px",
      cursor: "pointer",
    },
    deleteBtn: {
      width: "100%",
      padding: "15px",
      backgroundColor: "#FEF2F2",
      color: "#DC2626",
      border: "1px solid #FECACA",
      borderRadius: "10px",
      fontWeight: "bold",
      marginTop: "10px",
      cursor: "pointer",
    },
    textBtn: {
      border: "none",
      background: "none",
      color: "#EA580C",
      fontWeight: "bold",
      padding: "10px 0",
      cursor: "pointer",
    },
    actionBtn: {
      fontSize: "0.8rem",
      padding: "4px 8px",
      marginLeft: "5px",
      borderRadius: "6px",
      border: "1px solid #FED7AA",
      backgroundColor: "#FFF7ED",
      color: "#EA580C",
      cursor: "pointer",
    },
  };

  return (
    <div style={styles.container}>
      {/* --- 대시보드 화면 --- */}
      {viewMode === "dashboard" && (
        <>
          <div style={{ textAlign: "center", marginBottom: "30px" }}>
            <h2 style={{ color: "#9A3412" }}>송산초 학부모 알림이</h2>
          </div>
          <div style={styles.iconGrid}>
            <div
              style={styles.createCard}
              onClick={() => {
                setIsEditingEvent(false);
                setNewTargetCount(11);
                setViewMode("create");
              }}
            >
              <div
                style={{
                  fontSize: "2rem",
                  color: "#EA580C",
                  marginBottom: "5px",
                }}
              >
                +
              </div>
              <div
                style={{
                  fontWeight: "bold",
                  color: "#9A3412",
                  fontSize: "0.9rem",
                }}
              >
                새 참석자 조사
                <br />
                생성하기
              </div>
            </div>
            {surveys
              .filter((s) => !s.isArchived)
              .map((s) => (
                <div
                  key={s.id}
                  style={styles.iconCard}
                  onClick={() => {
                    setActiveSurveyId(s.id);
                    setViewMode("survey");
                  }}
                >
                  <div style={{ fontSize: "3rem", marginBottom: "10px" }}>
                    {s.icon}
                  </div>
                  <div style={{ fontWeight: "bold", fontSize: "0.9rem" }}>
                    {s.title}
                  </div>
                </div>
              ))}
          </div>
          <button
            style={{
              ...styles.textBtn,
              width: "100%",
              marginTop: "40px",
              textDecoration: "underline",
            }}
            onClick={() => setViewMode("history")}
          >
            지난 참석자 조사 이력 보기
          </button>
        </>
      )}

      {/* --- 행사 생성/수정 화면 (관리자용) --- */}
      {viewMode === "create" && (
        <div>
          <button
            onClick={() => {
              setIsEditingEvent(false);
              setViewMode(isEditingEvent ? "survey" : "dashboard");
            }}
            style={styles.textBtn}
          >
            ◀ 취소
          </button>
          <h2 style={{ color: "#9A3412", marginBottom: "20px" }}>
            {isEditingEvent ? "행사 내용 수정" : "새 참석자 조사 만들기"}
          </h2>
          <div style={styles.formGroup}>
            <label
              style={{
                fontWeight: "bold",
                fontSize: "0.9rem",
                color: "#EA580C",
              }}
            >
              참석자 조사 제목
            </label>
            <input
              style={styles.input}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="예: 봄 소풍 도시락 조사"
            />

            <label
              style={{
                fontWeight: "bold",
                fontSize: "0.9rem",
                color: "#EA580C",
              }}
            >
              조사 마감일
            </label>
            <input
              type="date"
              style={styles.input}
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
            />

            <label
              style={{
                fontWeight: "bold",
                fontSize: "0.9rem",
                color: "#EA580C",
              }}
            >
              행사 일시 (자유입력)
            </label>
            <input
              style={styles.input}
              value={newEventDate}
              onChange={(e) => setNewEventDate(e.target.value)}
              placeholder="예: 2026.04.25 오전 10시"
            />

            <label
              style={{
                fontWeight: "bold",
                fontSize: "0.9rem",
                color: "#EA580C",
              }}
            >
              총 대상 가족 수 (기본 11명)
            </label>
            <input
              type="number"
              style={styles.input}
              value={newTargetCount}
              onChange={(e) => setNewTargetCount(e.target.value)}
              min="1"
            />
          </div>
          <button style={styles.primaryBtn} onClick={handleSaveSurvey}>
            {isEditingEvent ? "수정 완료" : "생성하기"}
          </button>

          {isEditingEvent && (
            <button style={styles.deleteBtn} onClick={handleDeleteSurvey}>
              🗑️ 이 조사 삭제하기
            </button>
          )}
        </div>
      )}

      {/* --- 참석자 조사 작성 화면 --- */}
      {viewMode === "survey" && currentSurvey && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => {
                setEditingResponseId(null);
                setViewMode("dashboard");
              }}
              style={styles.textBtn}
            >
              ◀ 대시보드
            </button>
            <button onClick={openEditEvent} style={styles.actionBtn}>
              ⚙️ 행사 정보 수정
            </button>
          </div>

          <div style={{ textAlign: "center", margin: "20px 0" }}>
            <h2 style={{ margin: "0 0 10px 0" }}>{currentSurvey.title}</h2>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>
              📅 조사기한: {currentSurvey.deadline} 자정까지
              <br />⏰ 행사일시: {currentSurvey.eventDate}
            </div>
          </div>

          <div
            style={{
              ...styles.formGroup,
              border: editingResponseId ? "2px solid #EA580C" : "none",
            }}
          >
            {editingResponseId && (
              <div
                style={{
                  color: "#EA580C",
                  fontWeight: "bold",
                  marginBottom: "10px",
                }}
              >
                ✏️ 응답 내용 수정 중...
              </div>
            )}
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontWeight: "bold",
              }}
            >
              학생 이름
            </label>
            <input
              style={styles.input}
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="학생 이름을 입력하세요"
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <span style={{ fontWeight: "bold" }}>👨‍👩‍👧 어른 참석</span>
              <div>
                <button
                  style={styles.counterBtn}
                  onClick={() => setAdultCount(Math.max(0, adultCount - 1))}
                >
                  -
                </button>
                <span style={{ margin: "0 15px", fontWeight: "bold" }}>
                  {adultCount}
                </span>
                <button
                  style={styles.counterBtn}
                  onClick={() => setAdultCount(adultCount + 1)}
                >
                  +
                </button>
              </div>
            </div>
            {adultCount > 0 && (
              <div style={{ display: "flex", gap: "10px", fontSize: "0.9rem" }}>
                {["엄마", "아빠", "기타"].map((type) => (
                  <label key={type}>
                    <input
                      type="checkbox"
                      checked={adultTypes[type]}
                      onChange={() =>
                        setAdultTypes({
                          ...adultTypes,
                          [type]: !adultTypes[type],
                        })
                      }
                    />{" "}
                    {type}
                  </label>
                ))}
              </div>
            )}
            <hr style={{ border: "0.5px solid #FFF7ED", margin: "15px 0" }} />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontWeight: "bold" }}>🧒 아이 참석</span>
              <div>
                <button
                  style={styles.counterBtn}
                  onClick={() => setChildCount(Math.max(0, childCount - 1))}
                >
                  -
                </button>
                <span style={{ margin: "0 15px", fontWeight: "bold" }}>
                  {childCount}
                </span>
                <button
                  style={styles.counterBtn}
                  onClick={() => setChildCount(childCount + 1)}
                >
                  +
                </button>
              </div>
            </div>
          </div>
          <button style={styles.primaryBtn} onClick={handleSubmitResponse}>
            {editingResponseId ? "수정 완료" : "제출하기"}
          </button>

          {/* 실시간 명단 */}
          <div style={{ marginTop: "30px" }}>
            <h4
              style={{
                borderBottom: "2px solid #FFEDD5",
                paddingBottom: "10px",
                color: "#9A3412",
              }}
            >
              실시간 참석자 명단 <br />
              <span
                style={{
                  fontSize: "0.85rem",
                  color: "#EA580C",
                  fontWeight: "normal",
                  display: "block",
                  marginTop: "5px",
                  lineHeight: "1.4",
                }}
              >
                ({(currentSurvey.responses || []).length}가족 제출 / 미제출{" "}
                {Math.max(
                  0,
                  currentSurvey.targetFamilyCount -
                    (currentSurvey.responses || []).length
                )}
                가족)
                <br />
                (어른 {calculateTotals(currentSurvey.responses).adults}명, 아이{" "}
                {calculateTotals(currentSurvey.responses).children}명, 총{" "}
                {calculateTotals(currentSurvey.responses).total}명)
              </span>
            </h4>
            {(currentSurvey.responses || []).map((r) => (
              <div
                key={r.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #EEE",
                  fontSize: "0.9rem",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <strong>{r.studentName}</strong> : 어른 {r.adultCount} (
                  {r.adultTypes || "미선택"}) / 아이 {r.childCount}
                </div>
                <div>
                  <button
                    style={styles.actionBtn}
                    onClick={() => handleEditResponse(r)}
                  >
                    수정
                  </button>
                  <button
                    style={styles.actionBtn}
                    onClick={() => handleDeleteResponse(r.id)}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- 이력 화면 --- */}
      {viewMode === "history" && (
        <div>
          <button
            onClick={() => setViewMode("dashboard")}
            style={styles.textBtn}
          >
            ◀ 대시보드로
          </button>
          <h2 style={{ color: "#9A3412" }}>지난 참석자 조사 이력</h2>
          <p style={{ fontSize: "0.8rem", color: "#999" }}>
            ※ 마감 후 1년이 지난 데이터는 자동 영구 삭제됩니다.
          </p>
          {surveys
            .filter((s) => s.isArchived)
            .map((s) => (
              <div
                key={s.id}
                style={{
                  ...styles.formGroup,
                  borderLeft: "4px solid #FDBA74",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setActiveSurveyId(s.id);
                  setViewMode("historyDetail");
                }}
              >
                <div style={{ fontWeight: "bold" }}>{s.title} 🔍</div>
                <div style={{ fontSize: "0.8rem", color: "#999" }}>
                  마감: {s.deadline}
                </div>
                <div style={{ marginTop: "10px", fontSize: "0.85rem" }}>
                  총 {(s.responses || []).length}가족 제출 완료
                </div>
              </div>
            ))}
        </div>
      )}

      {/* --- 이력 상세 화면 --- */}
      {viewMode === "historyDetail" && currentSurvey && (
        <div>
          <button onClick={() => setViewMode("history")} style={styles.textBtn}>
            ◀ 이력 목록으로
          </button>
          <div style={styles.formGroup}>
            <h3 style={{ margin: "0 0 10px 0", color: "#9A3412" }}>
              {currentSurvey.title} (마감됨)
            </h3>
            <div
              style={{
                fontSize: "0.9rem",
                color: "#EA580C",
                fontWeight: "bold",
                marginBottom: "15px",
              }}
            >
              최종 참석: 어른 {calculateTotals(currentSurvey.responses).adults}
              명, 아이 {calculateTotals(currentSurvey.responses).children}명 (총{" "}
              {calculateTotals(currentSurvey.responses).total}명)
            </div>
            {(currentSurvey.responses || []).map((r) => (
              <div
                key={r.id}
                style={{
                  padding: "10px 0",
                  borderBottom: "1px solid #EEE",
                  fontSize: "0.9rem",
                }}
              >
                <strong>{r.studentName}</strong> : 어른 {r.adultCount} (
                {r.adultTypes || "미선택"}) / 아이 {r.childCount}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
