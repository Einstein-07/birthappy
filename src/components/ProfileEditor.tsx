"use client";

import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent
} from "react";
import { CakeSliceIcon, SparkIcon } from "@/components/Icons";
import { useToast } from "@/components/Toast";
import type { User } from "@/lib/types";

const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const AVATAR_SIZE = 512;
const TARGET_DATA_URL_BYTES = 460 * 1024;

function countCharacters(value: string) {
  return Array.from(value).length;
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("这张图片暂时无法读取，请更换一张"));
    };
    image.src = url;
  });
}

async function makeAvatarDataUrl(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("请选择 JPEG、PNG 或 WebP 图片");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("图片请小于 12MB");
  }

  const image = await loadImage(file);
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - side) / 2;
  const sourceY = (image.naturalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器暂时无法处理图片");

  context.fillStyle = "#f4eee5";
  context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    sourceX,
    sourceY,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  );

  let quality = 0.86;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (
    Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75) >
      TARGET_DATA_URL_BYTES &&
    quality > 0.55
  ) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (
    Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75) >
    512 * 1024
  ) {
    throw new Error("图片压缩后仍然太大，请换一张更简单的图片");
  }

  return dataUrl;
}

function avatarUrl(user: User) {
  return user.hasAvatar
    ? `/api/avatar/${user.id}?v=${encodeURIComponent(user.updatedAt)}`
    : null;
}

export function ProfileEditor({
  user,
  todayIso
}: {
  user: User;
  todayIso: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [birthday, setBirthday] = useState(user.birthday);
  const [isAnonymous, setIsAnonymous] = useState(user.isAnonymous);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(avatarUrl(user));
  const [avatarAction, setAvatarAction] = useState<"keep" | "replace" | "remove">(
    "keep"
  );
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [preparingAvatar, setPreparingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [savedNote, setSavedNote] = useState("");

  const bioLength = countCharacters(bio);
  const previewName = isAnonymous ? "匿名的朋友" : name.trim() || "你的称呼";
  const previewBio = bio.trim();
  const previewAvatarAlt = avatarSrc ? `${previewName}的头像预览` : "";

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPreparingAvatar(true);
    setGeneralError("");
    setErrors((current) => ({ ...current, avatar: "" }));
    try {
      const dataUrl = await makeAvatarDataUrl(file);
      setAvatarDataUrl(dataUrl);
      setAvatarSrc(dataUrl);
      setAvatarAction("replace");
      setSavedNote("");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        avatar:
          error instanceof Error ? error.message : "这张图片暂时无法使用"
      }));
    } finally {
      setPreparingAvatar(false);
    }
  }

  function removeAvatar() {
    setAvatarAction("remove");
    setAvatarDataUrl(null);
    setAvatarSrc(null);
    setErrors((current) => ({ ...current, avatar: "" }));
    setSavedNote("");
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "请填写一个称呼";
    else if (countCharacters(name.trim()) > 24) {
      nextErrors.name = "称呼最多 24 个字符";
    }
    if (bioLength > 160) nextErrors.bio = "简介最多 160 个字符";
    if (!birthday) nextErrors.birthday = "请选择生日";
    else if (birthday > todayIso) nextErrors.birthday = "生日不能晚于今天";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError("");
    setSavedNote("");
    if (!validate()) return;

    setSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
          birthday,
          isAnonymous,
          avatarAction,
          avatarDataUrl:
            avatarAction === "replace" ? avatarDataUrl : undefined
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | { user?: User; error?: string; fields?: Record<string, string> }
        | null;

      if (!response.ok || !payload?.user) {
        if (payload?.fields) setErrors(payload.fields);
        setGeneralError(payload?.error || "资料暂时没有保存成功，请稍后再试");
        return;
      }

      const savedUser = payload.user;
      setName(savedUser.name);
      setBio(savedUser.bio);
      setBirthday(savedUser.birthday);
      setIsAnonymous(savedUser.isAnonymous);
      setAvatarSrc(avatarUrl(savedUser));
      setAvatarAction("keep");
      setAvatarDataUrl(null);
      setSavedNote("已经保存");
      toast("资料已经替今天的你收好");
      router.refresh();
    } catch {
      setGeneralError("网络似乎走神了，请稍后再试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-card" aria-labelledby="profile-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">YOUR PROFILE</p>
          <h2 id="profile-heading">我的资料</h2>
        </div>
        <span className="panel-heading__note">首页上的你，由你决定</span>
      </div>

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        {generalError ? (
          <div className="form-alert" role="alert">
            <span aria-hidden="true">!</span>
            {generalError}
          </div>
        ) : null}

        <div className="profile-form__top">
          <div className="avatar-editor">
            <button
              type="button"
              className="avatar-editor__button avatar avatar--large"
              onClick={() => fileInput.current?.click()}
              aria-label="更换头像"
              disabled={preparingAvatar || saving}
            >
              {avatarSrc ? (
                <img
                  className="avatar__image"
                  src={avatarSrc}
                  alt="我的头像"
                  width={132}
                  height={132}
                />
              ) : (
                <span className="avatar__blank" aria-hidden="true" />
              )}
              <span className="avatar-editor__overlay">
                {preparingAvatar ? "正在处理" : "更换"}
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              className="visually-hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              tabIndex={-1}
            />
            <div className="avatar-editor__actions">
              <button
                type="button"
                className="text-button"
                onClick={() => fileInput.current?.click()}
                disabled={preparingAvatar || saving}
              >
                更换头像
              </button>
              {avatarSrc ? (
                <button
                  type="button"
                  className="text-button text-button--muted"
                  onClick={removeAvatar}
                  disabled={preparingAvatar || saving}
                >
                  移除
                </button>
              ) : null}
            </div>
            <p className="avatar-editor__hint">方形图片效果最好，最大 12MB</p>
          </div>

          <div className="profile-form__fields">
            <div className="field">
              <div className="field__label-row">
                <label className="field__label" htmlFor="profile-name">
                  称呼
                </label>
                <span className="field__hint">{countCharacters(name)} / 24</span>
              </div>
              <input
                id="profile-name"
                className={`text-input${errors.name ? " has-error" : ""}`}
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSavedNote("");
                }}
                placeholder="可填写昵称或真实姓名"
                maxLength={24}
                autoComplete="nickname"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? "profile-name-error" : undefined}
              />
              {errors.name ? (
                <p className="field__error" id="profile-name-error">
                  {errors.name}
                </p>
              ) : null}
            </div>

            <div className="field">
              <div className="field__label-row">
                <label className="field__label" htmlFor="profile-birthday">
                  生日
                </label>
                <span className="field__hint">年份不会公开</span>
              </div>
              <input
                id="profile-birthday"
                className={`text-input${errors.birthday ? " has-error" : ""}`}
                type="date"
                value={birthday}
                min="1900-01-01"
                max={todayIso}
                onChange={(event) => {
                  setBirthday(event.target.value);
                  setSavedNote("");
                }}
                autoComplete="bday"
                aria-invalid={Boolean(errors.birthday)}
                aria-describedby={
                  errors.birthday ? "profile-birthday-error" : undefined
                }
              />
              {errors.birthday ? (
                <p className="field__error" id="profile-birthday-error">
                  {errors.birthday}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {errors.avatar ? (
          <p className="field__error profile-form__avatar-error">
            {errors.avatar}
          </p>
        ) : null}

        <div className="field">
          <div className="field__label-row">
            <label className="field__label" htmlFor="profile-bio">
              简介
            </label>
            <span className="field__hint">{bioLength} / 160</span>
          </div>
          <textarea
            id="profile-bio"
            className={`text-input text-area${errors.bio ? " has-error" : ""}`}
            value={bio}
            onChange={(event) => {
              setBio(event.target.value);
              setSavedNote("");
            }}
            placeholder="一句话介绍自己，也可以留白"
            rows={3}
            maxLength={160}
            aria-invalid={Boolean(errors.bio)}
            aria-describedby={errors.bio ? "profile-bio-error" : "profile-bio-hint"}
          />
          {errors.bio ? (
            <p className="field__error" id="profile-bio-error">
              {errors.bio}
            </p>
          ) : (
            <p className="field__hint field__hint--block" id="profile-bio-hint">
              留白时，首页不会显示任何简介文字。
            </p>
          )}
        </div>

        <label className="switch-row">
          <span className="switch-row__copy">
            <span className="switch-row__title">在首页匿名展示</span>
            <span className="switch-row__note">
              开启后，其他人会看到「匿名的朋友」。你的称呼仍会保留在「我」页。
            </span>
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => {
                setIsAnonymous(event.target.checked);
                setSavedNote("");
              }}
            />
            <span className="switch__track" aria-hidden="true">
              <span className="switch__thumb" />
            </span>
          </span>
        </label>

        <div className="public-preview">
          <div className="public-preview__head">
            <span>公开预览</span>
            <span>首页 · 今天</span>
          </div>
          <div className="public-preview__card">
            <div className="avatar avatar--preview">
              {avatarSrc ? (
                <img
                  className="avatar__image"
                  src={avatarSrc}
                  alt={previewAvatarAlt}
                  width={64}
                  height={64}
                />
              ) : (
                <span className="avatar__blank" aria-hidden="true" />
              )}
            </div>
            <div className="public-preview__body">
              <div className="public-preview__name-row">
                <strong>{previewName}</strong>
                <span className="birthday-badge">
                  <span className="birthday-badge__dot" aria-hidden="true" />
                  今天生日
                </span>
                {isAnonymous ? <span className="privacy-tag">匿名</span> : null}
              </div>
              {previewBio ? (
                <p className="public-preview__bio">{previewBio}</p>
              ) : null}
            </div>
            <span className="public-preview__cake" aria-hidden="true">
              <CakeSliceIcon />
              送蛋糕
            </span>
          </div>
          <p className="public-preview__note">
            {isAnonymous
              ? "首页姓名将显示为「匿名的朋友」，简介和头像仍会公开。"
              : "这是其他人今天在首页看到的你。"}
          </p>
        </div>

        <div className="profile-form__footer">
          <div className="profile-form__status" aria-live="polite">
            {savedNote ? (
              <>
                <SparkIcon aria-hidden="true" />
                {savedNote}
              </>
            ) : (
              "资料修改后，点击保存才会生效。"
            )}
          </div>
          <button
            className="button button--primary"
            type="submit"
            disabled={saving || preparingAvatar}
          >
            {saving ? (
              <>
                <span className="button-spinner" aria-hidden="true" />
                正在保存
              </>
            ) : (
              "保存资料"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
